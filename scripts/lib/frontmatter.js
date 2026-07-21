#!/usr/bin/env node
/**
 * YAML frontmatter 파서 (검증기 공용).
 *
 * 정식 YAML 파서를 쓰지 않는 이유: 이 저장소는 빌드·패키지 매니저가 없다.
 * 의존성 0으로 유지하기 위해 검증에 필요한 만큼만 직접 파싱한다.
 *
 * 파싱 범위:
 *   - 최상위 키/값만 수집한다(들여쓰기된 줄은 중첩 값이므로 건너뜀).
 *   - 블록 스칼라(`|`, `>`)를 인식해 그 본문을 키로 오인하지 않는다.
 *   - 블록 스칼라 지시자를 키별로 기록한다 — `description`이 리터럴 `|`인지
 *     판별해야 하기 때문이다(아래 주석 참조).
 *   - UTF-8 BOM과 CRLF 줄바꿈을 허용한다.
 */

'use strict';

/**
 * 문서 선두의 frontmatter 블록을 잘라낸다.
 *
 * @param {string} content 마크다운 원문
 * @returns {{present: boolean, lines: string[]}}
 */
function extractFrontmatter(content) {
  // BOM(U+FEFF)이 있으면 제거 — 있으면 `^---` 매칭이 실패한다.
  const clean = content.replace(/^\uFEFF/, '');
  const match = clean.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return { present: false, lines: [] };
  }
  return { present: true, lines: match[1].split(/\r?\n/) };
}

/**
 * frontmatter 줄 배열에서 최상위 키/값과 블록 스칼라 지시자를 뽑는다.
 *
 * @param {string[]} lines
 * @returns {{
 *   values: Record<string, string>,
 *   indicators: Record<string, string>,
 *   duplicates: string[]
 * }}
 */
function inspectFrontmatter(lines) {
  const values = Object.create(null);
  const indicators = Object.create(null);
  const duplicates = [];

  let inBlockScalar = false;
  let blockScalarIndent = -1;

  for (const rawLine of lines) {
    if (inBlockScalar) {
      // 여는 줄보다 깊게 들여쓴 줄(및 빈 줄)은 블록 스칼라 본문이다.
      const indent = rawLine.match(/^(\s*)/)[1].length;
      if (rawLine.trim() === '' || indent > blockScalarIndent) {
        continue;
      }
      inBlockScalar = false;
      blockScalarIndent = -1;
    }

    const match = rawLine.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    // 따옴표 밖 주석을 제거해 `foo: # todo` 를 빈 값으로 취급한다.
    const value = match[2]
      .replace(/^\s*#.*$/, '')
      .replace(/\s+#.*$/, '')
      .trim();

    if (Object.prototype.hasOwnProperty.call(values, key)) {
      duplicates.push(key);
    }
    values[key] = value;

    // 블록 스칼라 지시자: `|`, `>` 에 chomp(`-`/`+`)와 들여쓰기 숫자가 붙을 수 있다.
    if (/^[|>](?:[+-]?\d+|\d+[+-]?|[+-])?$/.test(value)) {
      indicators[key] = value;
      inBlockScalar = true;
      blockScalarIndent = rawLine.match(/^(\s*)/)[1].length;
    }
  }

  return { values, indicators, duplicates };
}

/**
 * 따옴표로 감싼 스칼라 값의 따옴표를 벗긴다. (`name: "foo"` → `foo`)
 *
 * @param {string} value
 * @returns {string}
 */
function unquote(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

module.exports = { extractFrontmatter, inspectFrontmatter, unquote };
