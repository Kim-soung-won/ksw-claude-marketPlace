#!/usr/bin/env node
/**
 * 모든 검증을 순서대로 실행하는 진입점.
 *
 * 앞선 단계가 실패해도 중단하지 않고 전부 실행한다 — 커밋 한 번에
 * 모든 문제를 보여주기 위함이다. 하나라도 실패하면 exit 1.
 *
 * 정적 검증기(파일 모양이 맞나)와 단위 테스트(코드가 주장대로 동작하나)를 함께 돌린다.
 * 테스트를 여기 두는 이유: pre-commit 훅이 이 파일만 부르므로, 여기 없으면 테스트는
 * 어떤 자동 경로에서도 실행되지 않는다.
 *
 * 사용:
 *   node scripts/validate-all.js
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');

// Node 22의 --test는 glob을 확장하지 않으므로 파일 목록을 직접 전달한다.
function collectTests(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTests(filename);
    return entry.isFile() && entry.name.endsWith('.test.mjs') ? [filename] : [];
  }).sort();
}
const TEST_FILES = collectTests(path.join(REPO_ROOT, 'plugins'));

const STEPS = [
  ['Codex 설치 도구', [path.join(__dirname, 'test-install-codex-agents.py')], 'python3'],
  ['Codex 배포 정합성', [path.join(__dirname, 'validate-codex.js')]],
  ['Codex 에이전트 생성물', [path.join(__dirname, 'generate-codex-agents.js'), '--check']],
  ['매니페스트 정합성', [path.join(__dirname, 'validate-manifests.js')]],
  ['에이전트 정의', [path.join(__dirname, 'validate-agents.js')]],
  ['스킬 정의', [path.join(__dirname, 'validate-skills.js')]],
  ['개인 경로 유출', [path.join(__dirname, 'validate-personal-paths.js')]],
  ['CHANGELOG', [path.join(__dirname, 'validate-changelogs.js')]],
  // dot 리포터: 통과는 점 하나로 줄이고 실패만 자세히 편다. 커밋마다 도는 출력이라
  // 기본 spec 리포터의 케이스별 나열은 다른 검증기 결과를 밀어낸다.
  ['단위 테스트', ['--test', '--test-reporter=dot', ...TEST_FILES]],
];

let failed = 0;

for (const [label, argv, executable = process.execPath] of STEPS) {
  console.log(`\n▸ ${label}`);
  const result = spawnSync(executable, argv, {
    stdio: 'inherit',
    cwd: REPO_ROOT,
  });
  if (result.status !== 0) {
    failed += 1;
  }
}

console.log('');
if (failed > 0) {
  console.error(`검증 실패: ${failed}/${STEPS.length} 항목`);
  process.exit(1);
}

console.log(`검증 통과: ${STEPS.length}/${STEPS.length} 항목`);
