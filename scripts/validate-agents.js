#!/usr/bin/env node
/**
 * 에이전트 정의(plugins/<plugin>/agents/*.md) frontmatter 검증.
 *
 * 검사 항목:
 *   1. frontmatter 존재 및 최상위 키 중복 없음
 *   2. `name`, `description` 필수
 *   3. 파일명(확장자 제외) == frontmatter `name`  (CLAUDE.md 규약)
 *   4. `model` 이 있으면 허용값인지 (haiku|sonnet|opus|inherit)
 *   5. `description` 이 리터럴 블록 스칼라(`|`)가 아닌지
 *   6. [WARN] `tools` 누락 — 스펙상 유효(전체 상속)하지만 설계 원칙 5
 *      "도구는 최소 집합으로 스코핑한다" 위반 후보다
 *   7. [WARN] `description` 이 너무 짧음 — description 은 라벨이 아니라
 *      위임 조건이므로(설계 원칙 4) 트리거 문구가 담겨야 한다
 *
 * ERROR 가 하나라도 있으면 exit 1, WARN 만 있으면 exit 0.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { extractFrontmatter, inspectFrontmatter, unquote } = require('./lib/frontmatter');
const { forEachPluginFile, createReporter } = require('./lib/repo');

const VALID_MODELS = ['haiku', 'sonnet', 'opus', 'inherit'];

// 위임 조건으로 기능하려면 최소한 트리거 문구 한 줄은 필요하다.
const MIN_DESCRIPTION_LENGTH = 40;

function validateAgentFile(file, rel, report) {
  const content = fs.readFileSync(file, 'utf-8');
  const fm = extractFrontmatter(content);

  if (!fm.present) {
    report.error(`${rel} - frontmatter 없음`);
    return;
  }

  const { values, indicators, duplicates } = inspectFrontmatter(fm.lines);

  if (duplicates.length > 0) {
    report.error(`${rel} - frontmatter 키 중복: ${[...new Set(duplicates)].join(', ')}`);
  }

  for (const field of ['name', 'description']) {
    if (!values[field]) {
      report.error(`${rel} - 필수 필드 누락: ${field}`);
    }
  }

  const declaredName = unquote(values.name);
  const fileBase = path.basename(file, '.md');
  if (declaredName && declaredName !== fileBase) {
    report.error(`${rel} - 파일명('${fileBase}')과 frontmatter name('${declaredName}') 불일치`);
  }

  const model = unquote(values.model);
  if (model && !VALID_MODELS.includes(model)) {
    report.error(`${rel} - 잘못된 model '${model}'. 허용값: ${VALID_MODELS.join(', ')}`);
  }

  // 리터럴 `|` 는 개행을 보존해 description 을 여러 줄로 만든다 —
  // description 을 한 줄 스칼라로 소비하는 쪽에서 깨진다. 폴디드 `>`/`>-` 는 안전하다.
  if (indicators.description && indicators.description.startsWith('|')) {
    report.error(
      `${rel} - description 이 리터럴 블록 스칼라 '${indicators.description}' 사용. ` +
        `개행이 보존되므로 인라인 문자열이나 폴디드 '>-' 를 쓴다`
    );
  }

  if (!values.tools) {
    report.warn(`${rel} - tools 미선언 (전체 도구 상속). 설계 원칙 5: 최소 집합으로 스코핑`);
  }

  // 블록 스칼라면 values.description 에는 지시자만 담기므로 본문 길이를 따로 잰다.
  const descriptionLength = indicators.description
    ? measureBlockScalarLength(fm.lines, 'description')
    : unquote(values.description).length;
  if (values.description && descriptionLength < MIN_DESCRIPTION_LENGTH) {
    report.warn(
      `${rel} - description 이 ${descriptionLength}자로 짧음. ` +
        `설계 원칙 4: description 은 라벨이 아니라 위임 조건(트리거 문구·예시)이다`
    );
  }
}

/**
 * 블록 스칼라로 작성된 값의 본문 길이를 잰다.
 *
 * @param {string[]} lines frontmatter 줄 배열
 * @param {string} key 대상 키
 * @returns {number}
 */
function measureBlockScalarLength(lines, key) {
  const openIdx = lines.findIndex(l => new RegExp(`^${key}:\\s*[|>]`).test(l));
  if (openIdx === -1) {
    return 0;
  }
  let length = 0;
  for (const line of lines.slice(openIdx + 1)) {
    if (line.trim() !== '' && !/^\s/.test(line)) {
      break;
    }
    length += line.trim().length;
  }
  return length;
}

function main() {
  const report = createReporter('에이전트');
  const files = forEachPluginFile('agents', name => name.endsWith('.md'));

  for (const { absolute, relative } of files) {
    try {
      validateAgentFile(absolute, relative, report);
    } catch (err) {
      report.error(`${relative} - 읽기 실패: ${err.message}`);
    }
  }

  report.finish(files.length);
}

main();
