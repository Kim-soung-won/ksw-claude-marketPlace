#!/usr/bin/env node
/**
 * 외부 스킬 플러그인(third-party/<plugin>/)의 출처 기록 검증.
 *
 * 이 저장소는 공개 배포되므로, 외부 원본을 복사해 둔 파일은 언제든 "어디서, 어떤 라이선스로,
 * 어느 시점의 내용을 가져왔는지"를 증명할 수 있어야 한다. 또 원본을 로컬에서 고치면 갱신 때
 * 덮어써지거나 원본과 몰래 갈라지므로, 기록한 해시와 실제 파일이 같은지도 본다.
 *
 * 검사 항목:
 *   1. SOURCE.md 와 LICENSE 가 있음                                         [ERROR]
 *   2. SOURCE.md 에 원본 저장소(https URL)·커밋(40자 SHA)·라이선스·가져온 날짜   [ERROR]
 *   3. 파일 표의 로컬 경로가 존재하고 SHA-256 이 기록과 같음                   [ERROR]
 *   4. skills/ 아래 모든 파일이 파일 표에 있음(기록 없이 추가된 파일 없음)     [ERROR]
 *   5. third-party/README.md 목록에 플러그인이 있음                           [ERROR]
 *
 * 원본과의 실제 일치 여부(네트워크 조회)는 검사하지 않는다. 갱신 절차는 third-party/README.md.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { THIRD_PARTY_DIR, repoRelative, listThirdPartyPlugins, createReporter } = require('./lib/repo');

const REQUIRED_FIELDS = {
  '원본 저장소': value => /^https:\/\/\S+$/.test(value),
  커밋: value => /^[0-9a-f]{40}$/.test(value),
  라이선스: value => value.length > 0,
  '가져온 날짜': value => /^\d{4}-\d{2}-\d{2}$/.test(value),
};

/**
 * `- 키: 값` 형태의 목록 항목을 읽는다. 값의 백틱은 벗긴다.
 *
 * @param {string} content
 * @returns {Record<string, string>}
 */
function readFields(content) {
  const fields = {};
  for (const match of content.matchAll(/^- ([^:\n]+):\s*(.*)$/gm)) {
    fields[match[1].trim()] = match[2].trim().replace(/^`|`$/g, '');
  }
  return fields;
}

/**
 * `| 로컬 경로 | 원본 경로 | SHA-256 |` 표의 행을 읽는다.
 *
 * @param {string} content
 * @returns {Array<{local: string, hash: string}>}
 */
function readFileTable(content) {
  const rows = [];
  for (const match of content.matchAll(/^\|\s*`([^`]+)`\s*\|\s*`[^`]+`\s*\|\s*`([0-9a-f]{64})`\s*\|$/gm)) {
    rows.push({ local: match[1], hash: match[2] });
  }
  return rows;
}

function listFiles(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, out);
    } else if (entry.name !== '.DS_Store') {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const report = createReporter('외부 스킬');
  const plugins = listThirdPartyPlugins();
  const indexPath = path.join(THIRD_PARTY_DIR, 'README.md');
  const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';

  if (plugins.length > 0 && !index) {
    report.error('third-party/README.md 없음 — 외부 스킬 목록과 갱신 절차를 둔다');
  }

  for (const name of plugins) {
    const root = path.join(THIRD_PARTY_DIR, name);
    const rel = repoRelative(root);

    if (index && !index.includes(`(${name}/)`)) {
      report.error(`third-party/README.md - '${name}' 이 목록에 없음`);
    }
    if (!fs.existsSync(path.join(root, 'LICENSE'))) {
      report.error(`${rel}/LICENSE 없음 — 원본 라이선스 사본을 함께 배포한다`);
    }

    const sourcePath = path.join(root, 'SOURCE.md');
    if (!fs.existsSync(sourcePath)) {
      report.error(`${rel}/SOURCE.md 없음`);
      continue;
    }
    const source = fs.readFileSync(sourcePath, 'utf8');

    const fields = readFields(source);
    for (const [field, valid] of Object.entries(REQUIRED_FIELDS)) {
      if (!fields[field]) {
        report.error(`${rel}/SOURCE.md - '${field}' 없음`);
      } else if (!valid(fields[field])) {
        report.error(`${rel}/SOURCE.md - '${field}' 형식 오류: ${fields[field]}`);
      }
    }

    const rows = readFileTable(source);
    if (rows.length === 0) {
      report.error(`${rel}/SOURCE.md - 파일 표(로컬 경로·원본 경로·SHA-256) 없음`);
    }
    const recorded = new Set();
    for (const row of rows) {
      recorded.add(row.local);
      const file = path.join(root, row.local);
      if (!fs.existsSync(file)) {
        report.error(`${rel}/${row.local} - SOURCE.md 에 기록됐지만 파일 없음`);
        continue;
      }
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (actual !== row.hash) {
        report.error(`${rel}/${row.local} - 기록한 SHA-256 과 다름. 원본을 수정하지 않는다(갱신이면 SOURCE.md 도 함께 고친다)`);
      }
    }

    for (const file of listFiles(path.join(root, 'skills'))) {
      const local = path.relative(root, file).split(path.sep).join('/');
      if (!recorded.has(local)) {
        report.error(`${rel}/${local} - SOURCE.md 파일 표에 없는 파일`);
      }
    }
  }

  report.finish(plugins.length);
}

main();
