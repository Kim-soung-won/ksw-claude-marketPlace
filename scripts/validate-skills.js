#!/usr/bin/env node
/**
 * 스킬 정의(plugins/<plugin>/skills/<skill>/SKILL.md) 검증.
 *
 * 검사 항목:
 *   1. skills/ 하위 각 디렉터리에 SKILL.md 가 존재하고 비어 있지 않음  [ERROR]
 *   2. frontmatter 에 `name`, `description` 존재                        [ERROR]
 *   3. 디렉터리명 == frontmatter `name`  (CLAUDE.md 규약)               [ERROR]
 *   4. `description` 이 리터럴 블록 스칼라(`|`)가 아님                  [ERROR]
 *   5. `description` 이 트리거 문구를 담을 만큼 충분한 길이인지         [WARN]
 *
 * skills/ 가 없는 플러그인은 건너뛴다(에이전트 전용 플러그인이 정상이다).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { extractFrontmatter, inspectFrontmatter, unquote } = require('./lib/frontmatter');
const { PLUGINS_DIR, repoRelative, listPlugins, createReporter } = require('./lib/repo');

// 스킬 description 은 모델이 자동 호출 여부를 판단하는 유일한 근거다.
const MIN_DESCRIPTION_LENGTH = 40;

function collectSkillDirs() {
  const dirs = [];
  for (const plugin of listPlugins()) {
    const skillsDir = path.join(PLUGINS_DIR, plugin, 'skills');
    if (!fs.existsSync(skillsDir)) {
      continue;
    }
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        dirs.push({ plugin, name: entry.name, absolute: path.join(skillsDir, entry.name) });
      }
    }
  }
  return dirs;
}

function validateSkillDir(dir, report) {
  const skillMd = path.join(dir.absolute, 'SKILL.md');
  const rel = repoRelative(skillMd);

  if (!fs.existsSync(skillMd)) {
    report.error(`${repoRelative(dir.absolute)}/ - SKILL.md 없음`);
    return;
  }

  const content = fs.readFileSync(skillMd, 'utf-8');
  if (content.trim().length === 0) {
    report.error(`${rel} - 빈 파일`);
    return;
  }

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
  if (declaredName && declaredName !== dir.name) {
    report.error(`${rel} - 디렉터리명('${dir.name}')과 frontmatter name('${declaredName}') 불일치`);
  }

  if (indicators.description && indicators.description.startsWith('|')) {
    report.error(
      `${rel} - description 이 리터럴 블록 스칼라 '${indicators.description}' 사용. ` +
        `개행이 보존되므로 인라인 문자열이나 폴디드 '>-' 를 쓴다`
    );
  }

  if (values.description && !indicators.description) {
    const length = unquote(values.description).length;
    if (length < MIN_DESCRIPTION_LENGTH) {
      report.warn(`${rel} - description 이 ${length}자로 짧음. 트리거 문구와 사용 시점을 담는다`);
    }
  }
}

function main() {
  const report = createReporter('스킬');
  const dirs = collectSkillDirs();

  for (const dir of dirs) {
    try {
      validateSkillDir(dir, report);
    } catch (err) {
      report.error(`${repoRelative(dir.absolute)} - 검사 실패: ${err.message}`);
    }
  }

  report.finish(dirs.length);
}

main();
