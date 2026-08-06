#!/usr/bin/env node
/**
 * 플러그인마다 CHANGELOG.md 가 있고, 직접 올린 버전에는 그 항목이 있는지 검사한다.
 *
 * 왜 필요한가: 사용자 측 `/plugin marketplace update` 는 `version` 만 보고 갱신을 인식한다.
 * 버전이 올랐는데 기록이 없으면 소비자는 무엇이 바뀌었는지 알 방법이 전혀 없다 —
 * 커밋 메시지는 이 저장소를 clone 한 사람만 본다.
 *
 * 왜 "현재 버전 항목"을 무조건 ERROR 로 걸지 않는가: `.githooks/pre-commit` 은 검증기보다
 * **먼저** patch 를 자동으로 올린다(:57-104 → :107). 그래서 자동 상승 직후에는 방금 생긴
 * 버전에 항목이 있을 수가 없고, 무조건 ERROR 로 걸면 그 커밋이 통과할 방법이 없다.
 *
 * 그래서 기준을 나눈다:
 *   - minor·major 가 올랐거나 HEAD 에 없던 새 플러그인 = **직접 올린 것** = 말할 것이
 *     있어서 올린 버전이므로 항목을 ERROR 로 강제한다.
 *   - patch 만 올랐거나 그대로 = 자동 상승일 수 있으므로 WARN 만 남긴다.
 *
 * 버전 비교에 git 이 필요하다. 판정할 수 없으면(git 부재 등) 강제하지 않고 WARN 으로
 * 물러선다 — 판정 못 하는 것을 근거로 커밋을 막지 않는다.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { ROOT, PLUGINS_DIR, listPlugins, repoRelative, createReporter } = require('./lib/repo');

const CHANGELOG_NAME = 'CHANGELOG.md';

/**
 * `## [x.y.z]` 형태의 항목이 있는지 본다. 뒤에 날짜가 붙든 말든 상관하지 않는다.
 *
 * @param {string} content
 * @param {string} version
 * @returns {boolean}
 */
function hasEntry(content, version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^##\\s*\\[${escaped}\\]`, 'm').test(content);
}

function gitAvailable() {
  const result = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: ROOT, encoding: 'utf8' });
  return !result.error && result.status === 0;
}

/**
 * HEAD 시점의 매니페스트 버전. HEAD 에 파일이 없으면(새 플러그인) null.
 *
 * @param {string} relativeManifest 저장소 루트 기준 경로
 * @returns {string|null}
 */
function headVersion(relativeManifest) {
  const result = spawnSync('git', ['show', `HEAD:${relativeManifest}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.error || result.status !== 0) {
    return null;
  }
  try {
    return JSON.parse(result.stdout).version || null;
  } catch {
    return null;
  }
}

/**
 * 이 버전이 사람이 직접 올린 것인지 판정한다.
 *
 * 자동 상승은 patch 만 +1 하므로, minor·major 가 달라졌다면 직접 올린 것이다.
 * HEAD 에 매니페스트가 없으면 새로 추가한 플러그인이므로 역시 직접 정한 버전이다.
 *
 * @param {string} current
 * @param {string|null} head HEAD 버전 (없으면 새 플러그인)
 * @returns {boolean}
 */
function isDeliberate(current, head) {
  if (head === null) {
    return true;
  }
  const [curMajor, curMinor] = current.split('.');
  const [headMajor, headMinor] = head.split('.');
  return curMajor !== headMajor || curMinor !== headMinor;
}

function main() {
  const report = createReporter('CHANGELOG');
  const canCompare = gitAvailable();
  let checked = 0;

  for (const plugin of listPlugins()) {
    const manifestPath = path.join(PLUGINS_DIR, plugin, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      continue;
    }
    checked += 1;

    const changelogPath = path.join(PLUGINS_DIR, plugin, CHANGELOG_NAME);
    if (!fs.existsSync(changelogPath)) {
      report.error(
        `${repoRelative(changelogPath)} 없음 — 버전이 올라도 소비자가 변경 내용을 알 수 없다`
      );
      continue;
    }

    let version;
    try {
      version = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version;
    } catch {
      // 매니페스트 파싱 오류는 validate-manifests.js 소관이므로 여기서 중복 보고하지 않는다.
      continue;
    }
    if (!version) {
      continue;
    }

    if (hasEntry(fs.readFileSync(changelogPath, 'utf8'), version)) {
      continue;
    }

    const deliberate = canCompare && isDeliberate(version, headVersion(repoRelative(manifestPath)));
    const where = `${repoRelative(changelogPath)}`;
    if (deliberate) {
      report.error(
        `${where} 에 [${version}] 항목 없음 — minor·major 는 직접 올린 버전이므로 기록이 필요하다`
      );
    } else {
      report.warn(`${where} 에 [${version}] 항목 없음 — 자동 patch 상승이면 다음 커밋에 함께 적는다`);
    }
  }

  report.finish(checked);
}

main();
