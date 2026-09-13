/** 실제 훅 입출력 → 큐 → digest 통합 회귀. 외부 서버나 사용자 홈을 사용하지 않는다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'codex-capture-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, PLUGIN_ROOT: plugin, AGENT_FACTORY_HOME: path.join(root, 'factory'),
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.invalid' };
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo);
  const git = args => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8', stdio: ['ignore','pipe','ignore'] });
  git(['init','-q']); git(['commit','--allow-empty','-m','capture fixture','-q']);
  const run = (event, values = {}, overrides = {}) => {
    const result = spawnSync(process.execPath, [path.join(plugin,'hooks/dispatch-session.mjs')], {
      input: JSON.stringify({ hook_event_name:event, session_id:'../../unsafe-session', cwd:repo, ...values }),
      env: { ...env, ...overrides }, encoding:'utf8',
    });
    assert.equal(result.status,0,result.stderr); assert.deepEqual(JSON.parse(result.stdout),{});
  };
  const queue = () => {
    const file = path.join(env.AGENT_FACTORY_HOME,'queue.jsonl');
    return fs.existsSync(file) ? fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  };
  return { root, repo, env, run, queue };
}
test('Codex 공식 훅 입력을 큐와 digest로 연결하고 미측정 비용을 null로 보고한다', t => {
  const f=fixture(t);
  f.run('UserPromptSubmit',{prompt:'계약에 맞게 테스트를 추가해줘.'});
  f.run('PostToolUse',{tool_name:'Bash',tool_use_id:'test',tool_input:{command:'node --test'},tool_response:{exit_code:1,output:'테스트 실패'}});
  f.run('Stop',{last_assistant_message:'실패 원인을 확인했습니다.'});
  f.run('PostToolUse',{tool_name:'Bash',tool_use_id:'commit',tool_input:{command:'git commit -m test'},tool_response:{exit_code:0}});
  const [entry]=f.queue(); assert.ok(entry); assert.equal(entry.source_runtime,'codex-hooks');
  assert.equal(entry.session_id,'codex:../../unsafe-session');
  assert.ok(entry.jsonl_path.startsWith(path.join(f.env.AGENT_FACTORY_HOME,'codex/events/')));
  const result=spawnSync(process.execPath,[path.join(plugin,'scripts/distill-session.mjs'),'--all'],{env:f.env,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const [digest]=JSON.parse(result.stdout);
  assert.equal(digest.source_runtime,'codex-hooks'); assert.equal(digest.cost_tokens,null);
  assert.equal(digest.hygiene_delta,null); assert.ok(digest.measurement_limits.length);
  assert.ok(digest.timeline.some(x=>x.role==='user' && x.text.includes('계약')));
  assert.ok(digest.timeline.some(x=>x.error));
  assert.ok(digest.timeline.some(x=>x.role==='assistant' && x.text.includes('실패 원인')));
  const metrics=JSON.parse(fs.readFileSync(path.join(digest.sessions_dir, entry.commit.slice(0,7)+'.metrics.json'),'utf8'));
  assert.equal(metrics.source_runtime,'codex-hooks');
  assert.equal(metrics.session_hygiene,null);
  assert.ok(metrics.measurement_limits.length);
  assert.deepEqual(f.queue(),[]);
});
test('실패·성공 미확인 커밋은 큐에 넣지 않고 같은 커밋을 중복 캡처하지 않는다', t => {
  const f=fixture(t); const payload={tool_name:'Bash',tool_input:{command:'git commit -m test'}};
  f.run('PostToolUse',{...payload,tool_response:{exit_code:1}}); assert.equal(f.queue().length,0);
  f.run('PostToolUse',{...payload,tool_response:'unknown'}); assert.equal(f.queue().length,0);
  f.run('PostToolUse',{...payload,tool_response:'Process exited with code 0'}); assert.equal(f.queue().length,1);
  f.run('PostToolUse',{...payload,tool_response:{exit_code:0}}); assert.equal(f.queue().length,1);
});
test('Claude의 프롬프트·Stop은 Codex 이벤트를 기록하지 않는다', t => {
  const f=fixture(t);
  f.run('UserPromptSubmit',{prompt:'Claude 요청'},{PLUGIN_ROOT:''});
  f.run('Stop',{last_assistant_message:'Claude 응답'},{PLUGIN_ROOT:''});
  assert.equal(fs.existsSync(path.join(f.env.AGENT_FACTORY_HOME,'codex')),false);
});
test('공유 dispatch에서도 Claude 커밋의 원본 transcript 캡처를 유지한다', t => {
  const f=fixture(t);
  const transcript=path.join(f.root,'claude.jsonl');
  fs.writeFileSync(transcript,JSON.stringify({uuid:'claude-event',type:'user',message:{content:'원본 요청'}})+'\n');
  f.run('PostToolUse',{session_id:'claude-session',transcript_path:transcript,tool_name:'Bash',
    tool_input:{command:'git commit -m test'}},{PLUGIN_ROOT:''});
  const [entry]=f.queue();
  assert.equal(entry.jsonl_path,transcript);
  assert.equal(entry.session_id,'claude-session');
  assert.equal(entry.source_runtime,undefined);
  assert.equal(fs.existsSync(path.join(f.env.AGENT_FACTORY_HOME,'codex')),false);
});
test('Codex PreToolUse는 기존 Claude 자동 허용 결정을 반환하지 않는다', t => {
  const f=fixture(t);
  const result=spawnSync(process.execPath,[path.join(plugin,'hooks/allow-factory-paths.mjs'),plugin],{
    input:JSON.stringify({tool_name:'Write',tool_input:{file_path:path.join(f.env.AGENT_FACTORY_HOME,'report.md')}}),env:f.env,encoding:'utf8',
  });
  assert.equal(result.status,0); assert.equal(result.stdout,'');
});
