#!/usr/bin/env node
/** 공유 훅 진입점. Codex는 자체 이벤트를 수집하고 Claude는 기존 커밋 캡처를 사용한다. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { captureCodexEvent } from './capture-codex-events.mjs';
import { appendLog } from '../lib/factory-home.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  const raw = fs.readFileSync(0, 'utf8');
  const input = JSON.parse(raw);
  // PLUGIN_ROOT는 공식 Codex 플러그인 훅 환경 변수다. Markdown 치환과 별개다.
  const codex = process.env.PLUGIN_ROOT && path.resolve(process.env.PLUGIN_ROOT) === root;
  if (codex) captureCodexEvent(input);
  else if (input.hook_event_name === 'PostToolUse' && input.tool_name === 'Bash'
    && typeof input.tool_input?.command === 'string' && /\bgit\b[\s\S]*\bcommit\b/.test(input.tool_input.command)) {
    spawnSync(process.execPath, [path.join(root, 'hooks/capture-commit-session.mjs')], {
      input: raw, encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'ignore', 'ignore'],
    });
  }
} catch (error) {
  appendLog('capture', `훅 입력 처리 실패: ${error.message}`);
}
// Stop도 포함하므로 유효한 JSON을 반환한다. 승인·차단·재개를 요청하지 않는다.
process.stdout.write('{}');
