#!/usr/bin/env node
/**
 * 저장소 구조 탐색과 검증 결과 리포팅 공용 유틸.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PLUGINS_DIR = path.join(ROOT, 'plugins');

/**
 * 저장소 루트 기준 상대 경로로 정규화한다(Windows 구분자 포함).
 *
 * @param {string} absolute
 * @returns {string}
 */
function repoRelative(absolute) {
  return path.relative(ROOT, absolute).split(path.sep).join('/');
}

/**
 * plugins/ 아래 플러그인 디렉터리 이름 목록.
 *
 * @returns {string[]}
 */
function listPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => entry.name)
    .sort();
}

/**
 * 모든 플러그인의 특정 하위 디렉터리에서 조건에 맞는 파일을 수집한다.
 *
 * @param {string} subdir 플러그인 하위 디렉터리명 (예: 'agents')
 * @param {(name: string) => boolean} filter 파일명 필터
 * @returns {Array<{plugin: string, absolute: string, relative: string}>}
 */
function forEachPluginFile(subdir, filter) {
  const results = [];
  for (const plugin of listPlugins()) {
    const dir = path.join(PLUGINS_DIR, plugin, subdir);
    if (!fs.existsSync(dir)) {
      continue;
    }
    for (const name of fs.readdirSync(dir).sort()) {
      if (!filter(name)) {
        continue;
      }
      const absolute = path.join(dir, name);
      if (!fs.statSync(absolute).isFile()) {
        continue;
      }
      results.push({ plugin, absolute, relative: repoRelative(absolute) });
    }
  }
  return results;
}

/**
 * ERROR/WARN 을 누적하고 종료 코드를 결정하는 리포터를 만든다.
 *
 * ERROR 가 있으면 exit 1, WARN 만 있으면 exit 0 이다 — 훅이 경고 때문에
 * 커밋을 막지 않도록 하기 위함이다.
 *
 * @param {string} label 검증 대상 이름 (요약 문구에 사용)
 * @returns {{error: Function, warn: Function, finish: Function}}
 */
function createReporter(label) {
  let errorCount = 0;
  let warnCount = 0;

  return {
    error(message) {
      console.error(`ERROR: ${message}`);
      errorCount += 1;
    },
    warn(message) {
      console.warn(`WARN:  ${message}`);
      warnCount += 1;
    },
    finish(checkedCount) {
      const summary = [`${label} ${checkedCount}건 검사`];
      if (errorCount > 0) {
        summary.push(`오류 ${errorCount}`);
      }
      if (warnCount > 0) {
        summary.push(`경고 ${warnCount}`);
      }
      if (errorCount === 0 && warnCount === 0) {
        summary.push('이상 없음');
      }
      console.log(summary.join(' — '));
      process.exit(errorCount > 0 ? 1 : 0);
    },
  };
}

module.exports = { ROOT, PLUGINS_DIR, repoRelative, listPlugins, forEachPluginFile, createReporter };
