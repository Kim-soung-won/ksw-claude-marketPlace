#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

// 인증은 gh 키체인을 사용한다. 토큰이나 개인 저장소 정보는 플러그인에 넣지 않는다.
export function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
  });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} 실패: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

export function git(args, cwd) {
  return run('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.autocrlf=false',
    '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', ...args], cwd);
}

export function configPath() {
  return process.env.DOCS_BUCKET_CONFIG || path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'docs-bucket', 'config.json');
}

export function validateConfig(value) {
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(value.repo || '')) {
    throw new Error('repo는 GitHub의 owner/repository 형식이어야 합니다.');
  }
  if (typeof value.branch !== 'string' || !value.branch || value.branch.startsWith('-')) throw new Error('branch가 필요합니다.');
  git(['check-ref-format', '--branch', value.branch]);
  return { repo: value.repo, branch: value.branch };
}

export function safeRelative(value) {
  if (!value || path.posix.isAbsolute(value) || value.includes('\\') || /[\x00-\x1f]/.test(value)) throw new Error('유효한 저장소 상대 경로가 필요합니다.');
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || p.toLowerCase() === '.git')) throw new Error('경로 이탈 및 .git 경로는 허용하지 않습니다.');
  return value;
}

function noSymlinks(filename) {
  let current = path.parse(path.resolve(filename)).root;
  for (const part of path.resolve(filename).slice(current.length).split(path.sep)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`심볼릭 링크는 지원하지 않습니다: ${current}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export function checkedPath(root, relative) {
  const target = path.join(root, safeRelative(relative));
  noSymlinks(target);
  return target;
}

function filesUnder(source) {
  noSymlinks(source);
  const stat = fs.lstatSync(source);
  if (stat.isFile()) return [{ source, suffix: '' }];
  if (!stat.isDirectory()) throw new Error('일반 파일과 폴더만 지원합니다.');
  const result = [];
  function walk(dir, prefix) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const filename = path.join(dir, item.name);
      const suffix = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.isSymbolicLink()) throw new Error(`심볼릭 링크는 지원하지 않습니다: ${suffix}`);
      if (item.isDirectory()) walk(filename, suffix);
      else if (item.isFile()) result.push({ source: filename, suffix });
      else throw new Error(`일반 파일이 아닙니다: ${suffix}`);
    }
  }
  walk(source, '');
  if (!result.length) throw new Error('빈 폴더는 전송하지 않습니다.');
  return result;
}

function checkUploadName(relative) {
  safeRelative(relative);
  if (relative.split('/').some(p => /^(?:\.env(?:\..*)?|\.git|\.ssh|node_modules)$/i.test(p) || /\.(?:pem|key)$/i.test(p))) {
    throw new Error(`업로드 제외 경로입니다: ${relative}`);
  }
}

export function copySelection(source, destination, { replace = false, upload = false } = {}) {
  noSymlinks(destination);
  const plan = filesUnder(source).map(item => {
    const target = item.suffix ? checkedPath(destination, item.suffix) : destination;
    if (upload) checkUploadName(item.suffix || path.basename(source));
    noSymlinks(target);
    if (fs.existsSync(target)) {
      if (!fs.statSync(target).isFile()) throw new Error(`대상이 파일이 아닙니다: ${target}`);
      if (fs.readFileSync(target).equals(fs.readFileSync(item.source))) return null;
      if (!replace) throw new Error(`기존 파일이 다릅니다. 갱신 요청일 때 --replace를 사용하세요: ${target}`);
    }
    return { source: item.source, target };
  }).filter(Boolean);
  // 충돌 검사를 모두 마친 뒤 복사한다. 업로드 폴더의 기존 파일은 삭제하지 않는다.
  for (const item of plan) {
    fs.mkdirSync(path.dirname(item.target), { recursive: true });
    fs.copyFileSync(item.source, item.target);
  }
  return plan.length;
}

export function withCheckout(config, fn, remote = `https://github.com/${config.repo}.git`) {
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'docs-bucket-'));
  const checkout = path.join(temporary, 'repo');
  try {
    git(['clone', '--quiet', '--depth=1', '--single-branch', '--branch', config.branch, '--', remote, checkout]);
    return fn(checkout);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

export function head(checkout) { return git(['rev-parse', 'HEAD'], checkout); }

export function upload(checkout, config, source, target, options = {}) {
  checkUploadName(target);
  if (options.replace && !options.expectedHead) throw new Error('--replace에는 status에서 확인한 --expected-head가 필요합니다.');
  if (options.expectedHead && options.expectedHead !== head(checkout)) throw new Error('원격이 변경되었습니다. 최신 파일을 다시 확인하세요.');
  const destination = checkedPath(checkout, target);
  copySelection(path.resolve(source), destination, { replace: options.replace, upload: true });
  git(['add', '--', target], checkout);
  const changed = git(['diff', '--cached', '--name-only'], checkout);
  if (!changed) return { status: 'unchanged', commit: head(checkout), path: target };
  git(['diff', '--cached', '--check'], checkout);
  git(['-c', 'commit.gpgsign=false', 'commit', '-m', options.message || `docs: upload ${target}`], checkout);
  const commit = head(checkout);
  try { git(['push', 'origin', `HEAD:refs/heads/${config.branch}`], checkout); }
  catch {
    throw new Error(`푸시 성공 여부를 확인하지 못했습니다. 커밋 ${commit}의 원격 반영 여부를 먼저 확인하세요. 원본 파일은 보존되어 있습니다. 강제 푸시하지 말고 최신 상태를 조회하세요.`);
  }
  return { status: 'uploaded', commit, path: target };
}

function link(config, commit, relative, directory = false) {
  return `https://github.com/${config.repo}/${directory ? 'tree' : 'blob'}/${commit}/${relative.split('/').map(encodeURIComponent).join('/')}`;
}

export function main(argv) {
  const { values: options, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    config: { type: 'string' }, repo: { type: 'string' }, branch: { type: 'string' },
    replace: { type: 'boolean' }, 'expected-head': { type: 'string' }, message: { type: 'string' }, help: { type: 'boolean' },
  } });
  const [command, first, second] = positionals;
  if (options.help || !command) {
    return { usage: ['configure --repo owner/repository [--branch main]', 'status', 'list [검색어]',
      'get <저장소 경로> <로컬 경로> [--replace]',
      'put <로컬 파일 또는 폴더> <저장소 경로> [--replace --expected-head SHA]',
      '모든 명령: --config 설정파일. Node 22+, git, gh 로그인, Git 작성자 설정 필요.'] };
  }
  const filename = path.resolve(options.config || configPath());
  if (command === 'configure') {
    const config = validateConfig({ repo: options.repo, branch: options.branch || 'main' });
    noSymlinks(filename);
    if (fs.existsSync(filename)) {
      const old = validateConfig(JSON.parse(fs.readFileSync(filename, 'utf8')));
      if (JSON.stringify(old) === JSON.stringify(config)) return { status: 'unchanged', config: filename };
      if (!options.replace) throw new Error('기존 설정을 바꾸려면 --replace가 필요합니다.');
    }
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
    return { status: 'configured', config: filename };
  }
  if (!['status', 'list', 'get', 'put'].includes(command)) throw new Error(`지원하지 않는 명령: ${command}`);
  if (['get', 'put'].includes(command) && (!first || !second)) throw new Error('원본과 대상 경로가 필요합니다.');
  if (!fs.existsSync(filename)) throw new Error('개인 설정이 없습니다. configure --repo owner/repository를 먼저 실행하세요.');
  const config = validateConfig(JSON.parse(fs.readFileSync(filename, 'utf8')));
  // stdout에 인증 상태나 토큰을 출력하지 않는다. 연결 오류와 만료는 gh가 구분한다.
  run('gh', ['auth', 'status', '--hostname', 'github.com']);
  return withCheckout(config, checkout => {
    const commit = head(checkout);
    if (command === 'status') return { status: 'connected', ...config, commit };
    if (command === 'list') {
      const files = git(['ls-tree', '-r', '--name-only', '-z', 'HEAD'], checkout).split('\0').filter(Boolean)
        .filter(name => !first || name.toLowerCase().includes(first.toLowerCase()));
      return { ...config, commit, files };
    }
    if (command === 'get') {
      const source = checkedPath(checkout, first);
      const count = copySelection(source, path.resolve(second), { replace: options.replace });
      return { status: count ? 'downloaded' : 'unchanged', commit, destination: path.resolve(second), url: link(config, commit, first, fs.statSync(source).isDirectory()) };
    }
    const result = upload(checkout, config, first, second, {
      replace: options.replace, expectedHead: options['expected-head'], message: options.message,
    });
    return { ...result, url: link(config, result.commit, second, fs.statSync(path.resolve(first)).isDirectory()) };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(main(process.argv.slice(2)), null, 2) + '\n'); }
  catch (error) { process.stderr.write(JSON.stringify({ status: 'error', message: error.message }) + '\n'); process.exitCode = 1; }
}
