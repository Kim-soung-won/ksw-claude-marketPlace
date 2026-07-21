#!/usr/bin/env node
/**
 * 배포되는 파일에 사용자 고유 절대 경로가 섞여 들어가는 것을 막는다.
 *
 * 설계 원칙 2 강제: 리소스 경로는 `${CLAUDE_PLUGIN_ROOT}` 로 표현하고
 * `~` 나 사용자명을 하드코딩하지 않는다. 플러그인은 설치 시 별도 캐시
 * 디렉터리로 복사되므로, 저작 머신의 절대 경로는 설치된 환경에서 전부 깨진다.
 *
 * 검출 대상:
 *   - macOS: `/Users/<name>`
 *   - Windows: `C:\Users\<name>`
 *
 * 템플릿·예시에서 관용적으로 쓰는 자리표시자 사용자명은 허용한다.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { ROOT, repoRelative, createReporter } = require('./lib/repo');

const TARGETS = ['plugins', '.claude-plugin', 'CLAUDE.md', 'README.md', 'scripts'];

const SCANNED_EXTENSIONS = /\.(md|json|js|mjs|cjs|ts|sh|bash|zsh|toml|yml|yaml)$/i;

// 문서·예시에서 "여기에 당신 이름" 자리로 쓰는 값들 — 실제 유출이 아니다.
const PLACEHOLDER_USERNAMES = new Set([
  'example',
  'me',
  'user',
  'username',
  'you',
  'your-username',
  'yourname',
  'yourusername',
]);

// `<name>`, `<username>` 처럼 꺾쇠로 감싼 토큰은 문서상의 자리표시자다.
const ANGLE_PLACEHOLDER_RE = /^<[^>]*>?$/;

/**
 * 검출된 사용자명이 실제 유출인지 자리표시자인지 판정한다.
 *
 * @param {string} username
 * @returns {boolean}
 */
function isPlaceholder(username) {
  return PLACEHOLDER_USERNAMES.has(username.toLowerCase()) || ANGLE_PLACEHOLDER_RE.test(username);
}

const POSIX_USER_RE = /\/Users\/([a-zA-Z<][a-zA-Z0-9._<>-]*)/g;
const WIN_USER_RE = /C:\\Users\\([a-zA-Z<][a-zA-Z0-9._<>-]*)/gi;

/**
 * 내용에서 자리표시자가 아닌 사용자 경로를 모두 찾는다.
 *
 * @param {string} content
 * @returns {Array<{match: string, line: number}>}
 */
function findLeaks(content) {
  const leaks = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of [POSIX_USER_RE, WIN_USER_RE]) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        if (!isPlaceholder(match[1])) {
          leaks.push({ match: match[0], line: index + 1 });
        }
      }
    }
  });

  return leaks;
}

function collectFiles(target, out) {
  if (!fs.existsSync(target)) {
    return;
  }
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    out.push(target);
    return;
  }
  for (const entry of fs.readdirSync(target)) {
    if (entry === 'node_modules' || entry === '.git') {
      continue;
    }
    collectFiles(path.join(target, entry), out);
  }
}

function main() {
  const report = createReporter('파일');

  const files = [];
  for (const target of TARGETS) {
    collectFiles(path.join(ROOT, target), files);
  }

  const scanned = files.filter(file => SCANNED_EXTENSIONS.test(file));

  for (const file of scanned) {
    // 이 검증기 자신은 자리표시자 목록과 정규식 때문에 스스로를 검출한다.
    if (path.basename(file) === path.basename(__filename)) {
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    for (const leak of findLeaks(content)) {
      report.error(
        `${repoRelative(file)}:${leak.line} - 개인 절대 경로 "${leak.match}" 발견. ` +
          '`${CLAUDE_PLUGIN_ROOT}` 또는 상대 경로로 바꾼다'
      );
    }
  }

  report.finish(scanned.length);
}

main();
