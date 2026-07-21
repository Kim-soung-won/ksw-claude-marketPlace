#!/usr/bin/env node
/**
 * 매니페스트 정합성 검증 — marketplace.json ↔ plugins/<name>/.claude-plugin/plugin.json.
 *
 * CLAUDE.md 규약 강제: "새 플러그인을 추가하면 반드시 두 곳을 동기화한다."
 * 한쪽만 고친 커밋은 사용자 측에서 플러그인이 아예 보이지 않거나
 * 설치 후 이름이 어긋나는 형태로 조용히 실패하므로 커밋 전에 잡는다.
 *
 * 검사 항목:
 *   1. marketplace.json 과 모든 plugin.json 이 JSON 으로 파싱됨
 *   2. marketplace.json 의 각 항목: name/source/description 존재
 *   3. source 경로가 실제로 존재하고 그 안에 plugin.json 이 있음
 *   4. 항목 name == 디렉터리명 == plugin.json 의 name (3자 일치)
 *   5. plugin.json 의 version 이 SemVer 형식
 *   6. plugins/ 에 있으나 marketplace.json 에 등재되지 않은 플러그인 없음
 *   7. [WARN] marketplace 항목과 plugin.json 의 description 불일치
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { ROOT, PLUGINS_DIR, repoRelative, listPlugins, createReporter } = require('./lib/repo');

const MARKETPLACE_PATH = path.join(ROOT, '.claude-plugin', 'marketplace.json');
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * JSON 파일을 읽어 파싱한다. 실패 시 null 을 반환하고 오류를 보고한다.
 *
 * @param {string} file
 * @param {{error: Function}} report
 * @returns {object|null}
 */
function readJson(file, report) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    report.error(`${repoRelative(file)} - JSON 파싱 실패: ${err.message}`);
    return null;
  }
}

function main() {
  const report = createReporter('매니페스트');

  if (!fs.existsSync(MARKETPLACE_PATH)) {
    report.error('.claude-plugin/marketplace.json 없음');
    report.finish(0);
    return;
  }

  const marketplace = readJson(MARKETPLACE_PATH, report);
  if (!marketplace) {
    report.finish(1);
    return;
  }

  if (!Array.isArray(marketplace.plugins)) {
    report.error('marketplace.json - plugins 배열 없음');
    report.finish(1);
    return;
  }

  const listedNames = new Set();
  let checked = 1;

  for (const entry of marketplace.plugins) {
    const label = entry.name || '(name 없음)';
    checked += 1;

    for (const field of ['name', 'source', 'description']) {
      if (!entry[field]) {
        report.error(`marketplace.json - '${label}' 항목에 ${field} 없음`);
      }
    }
    if (!entry.name || !entry.source) {
      continue;
    }

    listedNames.add(entry.name);

    const sourceDir = path.resolve(ROOT, entry.source);
    if (!fs.existsSync(sourceDir)) {
      report.error(`marketplace.json - '${label}' 의 source 경로 없음: ${entry.source}`);
      continue;
    }

    const dirName = path.basename(sourceDir);
    if (dirName !== entry.name) {
      report.error(`marketplace.json - '${label}' 의 name 과 디렉터리명('${dirName}') 불일치`);
    }

    const manifestPath = path.join(sourceDir, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      report.error(`${entry.source} - .claude-plugin/plugin.json 없음`);
      continue;
    }

    const manifest = readJson(manifestPath, report);
    if (!manifest) {
      continue;
    }

    if (manifest.name !== entry.name) {
      report.error(
        `${repoRelative(manifestPath)} - name('${manifest.name}')이 ` +
          `marketplace 항목('${entry.name}')과 불일치`
      );
    }

    if (!manifest.version) {
      report.error(`${repoRelative(manifestPath)} - version 없음 (명시 버전이 캐시 갱신 키다)`);
    } else if (!SEMVER_RE.test(manifest.version)) {
      report.error(`${repoRelative(manifestPath)} - version '${manifest.version}' 이 SemVer 형식이 아님`);
    }

    if (manifest.description && entry.description && manifest.description !== entry.description) {
      report.warn(`'${entry.name}' - marketplace 와 plugin.json 의 description 이 다름`);
    }
  }

  // 역방향: 디렉터리는 있는데 등재되지 않은 플러그인은 사용자에게 보이지 않는다.
  for (const plugin of listPlugins()) {
    if (!listedNames.has(plugin)) {
      const hasManifest = fs.existsSync(path.join(PLUGINS_DIR, plugin, '.claude-plugin', 'plugin.json'));
      if (hasManifest) {
        report.error(`plugins/${plugin} - marketplace.json 의 plugins[] 에 등재되지 않음`);
      }
    }
  }

  report.finish(checked);
}

main();
