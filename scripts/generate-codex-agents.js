#!/usr/bin/env node
/**
 * 호스트 중립 절차로 이전한 에이전트의 Codex 등록 템플릿(codex/agents/<name>.json)을 생성한다.
 *
 *   node scripts/generate-codex-agents.js           # 생성(덮어쓰기)
 *   node scripts/generate-codex-agents.js --check   # 생성물이 원본과 같은지만 검사 (validate-all)
 *
 * 대상: `resources/<name>/procedure.md`가 있는 에이전트만. 아직 이전하지 않은 에이전트의
 * 수작업 템플릿은 건드리지 않는다 — 플러그인 단위로 점진 이전하기 위함이다.
 *
 * 원본 → 생성물 규칙:
 *   - name        = agents/<name>.md frontmatter `name`
 *   - description = 같은 frontmatter `description`에서 <example> 블록을 뺀 문장
 *   - sandbox_mode = `tools`에 Write·Edit·NotebookEdit 중 하나가 있으면 workspace-write, 아니면 read-only
 *   - developer_instructions = procedure.md를 가리키는 고정 문구
 * 따라서 설명·권한을 바꾸려면 Claude 에이전트 frontmatter만 고치고 이 스크립트를 다시 돌린다.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, listPlugins, createReporter } = require('./lib/repo');
const { extractFrontmatter, inspectFrontmatter, unquote } = require('./lib/frontmatter');

const WRITE_TOOLS = ['Write', 'Edit', 'NotebookEdit'];

/** 최상위 키의 값을 읽는다. 폴디드 블록 스칼라(`>`, `>-`)는 줄을 공백으로 이어 붙인다. */
function readScalar(lines, key) {
  const start = lines.findIndex(line => line.startsWith(key + ':'));
  if (start === -1) return '';
  const head = lines[start].slice(key.length + 1).trim();
  if (!/^>[+-]?$/.test(head)) return unquote(head);
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== '' && !/^\s/.test(line)) break;
    body.push(line.trim());
  }
  return body.join(' ');
}

function render(agentFile) {
  const content = fs.readFileSync(agentFile, 'utf8');
  const { lines } = extractFrontmatter(content);
  const { values } = inspectFrontmatter(lines);
  const name = unquote(values.name);
  const description = readScalar(lines, 'description')
    .replace(/<example>[\s\S]*?<\/example>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const tools = (values.tools || '').split(',').map(tool => tool.trim());
  const procedure = `resources/${name}/procedure.md`;
  const template = {
    name,
    description,
    sandbox_mode: tools.some(tool => WRITE_TOOLS.includes(tool)) ? 'workspace-write' : 'read-only',
    developer_instructions: [
      '플러그인 위치: {{PLUGIN_ROOT}}',
      `\`{{PLUGIN_ROOT}}/${procedure}\`를 업무 절차 원본으로 읽고 그대로 수행한다.`,
      '절차 안의 상대 경로는 그 문서 디렉터리 기준이다. 요청 범위와 현재 sandbox 권한을 넘는 변경을 하지 않는다.',
      '사용자에게 직접 물을 수 없으면 필요한 정보를 구체적으로 적어 메인 에이전트에 반환한다.',
    ].join('\n'),
  };
  return JSON.stringify(template, null, 2) + '\n';
}

function main() {
  const check = process.argv.includes('--check');
  const report = createReporter('Codex 에이전트 생성물');
  let checked = 0;
  for (const plugin of listPlugins()) {
    const root = path.join(ROOT, 'plugins', plugin);
    const agentsDir = path.join(root, 'agents');
    if (!fs.existsSync(agentsDir)) continue;
    for (const file of fs.readdirSync(agentsDir).filter(name => name.endsWith('.md')).sort()) {
      const name = file.replace(/\.md$/, '');
      if (!fs.existsSync(path.join(root, 'resources', name, 'procedure.md'))) continue;
      checked++;
      const target = path.join(root, 'codex', 'agents', name + '.json');
      const expected = render(path.join(agentsDir, file));
      const actual = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
      if (actual === expected) continue;
      if (check) {
        report.error(`plugins/${plugin}/codex/agents/${name}.json - 원본과 다름. node scripts/generate-codex-agents.js 로 재생성`);
      } else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, expected);
        console.log(`생성: plugins/${plugin}/codex/agents/${name}.json`);
      }
    }
  }
  report.finish(checked);
}

main();
