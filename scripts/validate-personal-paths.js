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
const { spawnSync } = require('child_process');

const { ROOT, repoRelative, createReporter } = require('./lib/repo');

// 배포에 실려 나갈 수 있는 곳은 전부 본다. `docs`·`.claude` 가 빠져 있어
// `docs/issues/` 의 로그 인용에 섞인 개인 경로가 오래 통과했다.
const TARGETS = ['plugins', '.claude-plugin', 'docs', '.claude', 'CLAUDE.md', 'README.md', 'scripts'];

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

/**
 * git 이 무시하는 파일을 걸러낸다.
 *
 * 이 검증기의 대상은 "배포되는 파일"이다. gitignore 된 파일(머신별 로컬 설정,
 * `.agent-factory/` 잔재 등)은 커밋되지 않으므로 유출 경로가 아니고, 오히려 개인
 * 절대 경로가 들어 있는 게 정상이다. 그것까지 오류로 세면 검증기를 끄게 만든다.
 *
 * 판정에 실패하면 거르지 않는다 — 덜 검사하는 쪽이 아니라 더 검사하는 쪽으로 물러선다.
 *
 * @param {string[]} files 절대 경로 목록
 * @returns {string[]}
 */
function rejectIgnored(files) {
  if (files.length === 0) {
    return files;
  }
  const relatives = files.map(file => repoRelative(file));
  // -z: 입력·출력 모두 NUL 구분. 경로에 공백·비ASCII 가 섞여도 안전하다.
  const result = spawnSync('git', ['check-ignore', '-z', '--stdin'], {
    cwd: ROOT,
    input: relatives.join('\0'),
    encoding: 'utf8',
  });
  // 0 = 무시되는 경로 있음, 1 = 없음. 그 밖(git 부재·비-git 디렉터리 등)은 판정 실패.
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    return files;
  }
  const ignored = new Set(result.stdout.split('\0').filter(Boolean));
  return files.filter((_, index) => !ignored.has(relatives[index]));
}

function main() {
  const report = createReporter('파일');

  const files = [];
  for (const target of TARGETS) {
    collectFiles(path.join(ROOT, target), files);
  }

  const scanned = rejectIgnored(files.filter(file => SCANNED_EXTENSIONS.test(file)));

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
