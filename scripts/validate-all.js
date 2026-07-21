#!/usr/bin/env node
/**
 * 모든 검증기를 순서대로 실행하는 진입점.
 *
 * 앞선 검증기가 실패해도 중단하지 않고 전부 실행한다 — 커밋 한 번에
 * 모든 문제를 보여주기 위함이다. 하나라도 실패하면 exit 1.
 *
 * 사용:
 *   node scripts/validate-all.js
 */

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const VALIDATORS = [
  ['매니페스트 정합성', 'validate-manifests.js'],
  ['에이전트 정의', 'validate-agents.js'],
  ['스킬 정의', 'validate-skills.js'],
  ['개인 경로 유출', 'validate-personal-paths.js'],
];

let failed = 0;

for (const [label, script] of VALIDATORS) {
  console.log(`\n▸ ${label}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    failed += 1;
  }
}

console.log('');
if (failed > 0) {
  console.error(`검증 실패: ${failed}/${VALIDATORS.length} 항목`);
  process.exit(1);
}

console.log(`검증 통과: ${VALIDATORS.length}/${VALIDATORS.length} 항목`);
