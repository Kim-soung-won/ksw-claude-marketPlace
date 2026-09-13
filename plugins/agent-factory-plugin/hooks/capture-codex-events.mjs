/** Codex 공식 훅 입력을 자체 JSONL로 기록한다. 내부 transcript 형식에는 의존하지 않는다. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homePath } from '../lib/factory-home.mjs';

const capture = fileURLToPath(new URL('./capture-commit-session.mjs', import.meta.url));
const MAX_TEXT = 16000;
const text = value => {
  const string = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return string.length > MAX_TEXT ? string.slice(0, MAX_TEXT) + '\n[hook capture truncated]' : string;
};

export function captureCodexEvent(input) {
  if (typeof input.session_id !== 'string' || !input.session_id) return;
  const key = crypto.createHash('sha256').update(input.session_id).digest('hex');
  const dir = homePath('codex', 'events');
  const file = path.join(dir, key + '.jsonl');
  const base = { source_runtime: 'codex-hooks', timestamp: new Date().toISOString(), uuid: crypto.randomUUID() };
  let events = [];
  if (input.hook_event_name === 'UserPromptSubmit' && typeof input.prompt === 'string') {
    events = [{ ...base, type: 'user', message: { content: text(input.prompt) } }];
  } else if (input.hook_event_name === 'Stop' && typeof input.last_assistant_message === 'string') {
    events = [{ ...base, type: 'assistant', message: { content: [{ type: 'text', text: text(input.last_assistant_message) }] } }];
  } else if (input.hook_event_name === 'PostToolUse') {
    const name = input.tool_name;
    if (typeof name !== 'string') return;
    const raw = input.tool_input ?? {};
    const id = input.tool_use_id || base.uuid;
    const tool = /^(Bash|exec_command|shell_command)$/.test(name) ? 'Bash' : name;
    // 도구 입력 전체(파일 전문·대규모 patch)를 보관하지 않는다.
    const compact = tool === 'Bash' ? { command: text(raw.command ?? raw.cmd ?? '') }
      : { file_path: raw.file_path, description: text(raw.description ?? raw.task_name ?? name) };
    let response = input.tool_response;
    if (typeof response === 'string') {
      try { response = JSON.parse(response); } catch { /* 호스트의 텍스트 출력을 그대로 기록 */ }
    }
    const exitCode = response?.exit_code ?? response?.exitCode;
    const failed = response?.is_error === true || response?.isError === true || (typeof exitCode === 'number' && exitCode !== 0);
    events = [
      { ...base, type: 'assistant', message: { content: [{ type: 'tool_use', id, name: tool, input: compact }] } },
      { ...base, uuid: crypto.randomUUID(), type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: failed, content: text(input.tool_response) }] } },
    ];
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.appendFileSync(file, events.map(e => JSON.stringify(e)).join('\n') + '\n', { mode: 0o600 });
    // 성공 확인이 없는 Bash 결과로는 커밋을 추정하지 않는다. 긴 명령의 poll 완료는
    // 호스트가 원래 명령의 PostToolUse로 전달할 때 같은 경로로 처리된다.
    const status = typeof exitCode === 'number' ? exitCode
      : typeof response === 'string' ? Number(response.match(/(?:Process exited with code|exit code:)\s*(\d+)/i)?.[1] ?? NaN) : NaN;
    if (tool === 'Bash' && !failed && status === 0 && /\bgit\b[^\n]*\bcommit\b/.test(compact.command)) {
      spawnSync(process.execPath, [capture], {
        input: JSON.stringify({ ...input, session_id: 'codex:' + input.session_id, transcript_path: file,
          source_runtime: 'codex-hooks', tool_input: { command: raw.command ?? raw.cmd } }),
        encoding: 'utf8', timeout: 10000,
        env: { ...process.env, AGENT_FACTORY_RUNTIME: 'codex-hooks' },
        stdio: ['pipe', 'ignore', 'ignore'],
      });
    }
    return;
  }
  if (events.length) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.appendFileSync(file, events.map(e => JSON.stringify(e)).join('\n') + '\n', { mode: 0o600 });
  }
}
