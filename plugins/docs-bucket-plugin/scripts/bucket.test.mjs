import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, withCheckout, upload, head, copySelection, checkedPath, main } from './bucket.mjs';

process.env.GIT_AUTHOR_NAME = process.env.GIT_COMMITTER_NAME = '문서 버킷 테스트';
process.env.GIT_AUTHOR_EMAIL = process.env.GIT_COMMITTER_EMAIL = 'bucket-test@example.invalid';
const config = { repo: 'example/docs', branch: 'main' };

function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bucket-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, 'remote.git');
  const seed = path.join(root, 'seed');
  git(['init', '--bare', '--initial-branch=main', remote]);
  git(['clone', remote, seed]);
  fs.writeFileSync(path.join(seed, 'README.md'), '# 문서\n');
  git(['add', '.'], seed);
  git(['-c', 'commit.gpgsign=false', 'commit', '-m', '초기 문서'], seed);
  git(['push', 'origin', 'main'], seed);
  return { root, remote, seed, checkout: fn => withCheckout(config, fn, remote) };
}

test('HTML 폴더와 첨부를 함께 업로드하고 정확한 바이트로 가져온다', t => {
  const f = fixture(t);
  const source = path.join(f.root, '보고서');
  fs.mkdirSync(path.join(source, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(source, 'index.html'), '<img src="assets/그림.png">\n');
  const image = Buffer.from([0, 255, 1, 128]);
  fs.writeFileSync(path.join(source, 'assets/그림.png'), image);
  const result = f.checkout(c => upload(c, config, source, 'html/한글 보고서'));
  assert.equal(result.status, 'uploaded');
  f.checkout(c => {
    assert.equal(head(c), result.commit);
    const destination = path.join(f.root, 'download');
    copySelection(checkedPath(c, 'html/한글 보고서'), destination);
    assert.deepEqual(fs.readFileSync(path.join(destination, 'assets/그림.png')), image);
    assert.equal(fs.readFileSync(path.join(destination, 'index.html'), 'utf8'), '<img src="assets/그림.png">\n');
  });
  assert.equal(f.checkout(c => upload(c, config, source, 'html/한글 보고서')).status, 'unchanged');
});

test('원격 파일 갱신에는 명시적 교체와 최신 커밋이 필요하다', t => {
  const f = fixture(t);
  const source = path.join(f.root, 'new.md'); fs.writeFileSync(source, '# 새 문서\n');
  f.checkout(c => {
    const original = head(c);
    assert.throws(() => upload(c, config, source, 'README.md'), /기존 파일/);
    assert.throws(() => upload(c, config, source, 'README.md', { replace: true }), /expected-head/);
    assert.throws(() => upload(c, config, source, 'README.md', { replace: true, expectedHead: 'stale' }), /원격이 변경/);
    assert.equal(upload(c, config, source, 'README.md', { replace: true, expectedHead: original }).status, 'uploaded');
  });
  f.checkout(c => assert.equal(fs.readFileSync(path.join(c, 'README.md'), 'utf8'), '# 새 문서\n'));
});

test('동시 푸시는 원격 변경을 덮어쓰지 않고 실패한다', t => {
  const f = fixture(t);
  const a = path.join(f.root, 'a.md'); const b = path.join(f.root, 'b.md');
  fs.writeFileSync(a, 'A\n'); fs.writeFileSync(b, 'B\n');
  f.checkout(old => {
    f.checkout(fresh => upload(fresh, config, a, 'docs/a.md'));
    assert.throws(() => upload(old, config, b, 'docs/b.md'), /푸시 성공 여부/);
  });
  f.checkout(c => {
    assert.equal(fs.readFileSync(path.join(c, 'docs/a.md'), 'utf8'), 'A\n');
    assert.equal(fs.existsSync(path.join(c, 'docs/b.md')), false);
  });
  assert.equal(fs.readFileSync(b, 'utf8'), 'B\n');
});

test('경로 이탈·Git 메타데이터·심볼릭 링크 업로드를 거부한다', t => {
  const f = fixture(t);
  const source = path.join(f.root, 'file.md'); fs.writeFileSync(source, 'safe\n');
  f.checkout(c => {
    for (const target of ['../escape', '/absolute', '.git/config', 'docs/../escape', 'docs/.env', 'assets/key.pem']) {
      assert.throws(() => upload(c, config, source, target));
    }
    fs.symlinkSync(f.root, path.join(c, 'escape'));
    assert.throws(() => upload(c, config, source, 'escape/file.md'), /심볼릭 링크/);
    const linked = path.join(f.root, 'linked.md'); fs.symlinkSync(source, linked);
    assert.throws(() => upload(c, config, linked, 'docs/linked.md'), /심볼릭 링크/);
  });
});

test('폴더 전송 충돌은 복사 전에 감지하고 기존 파일을 보존한다', t => {
  const f = fixture(t);
  const source = path.join(f.root, 'source'); const destination = path.join(f.root, 'destination');
  fs.mkdirSync(source); fs.mkdirSync(destination);
  fs.writeFileSync(path.join(source, 'a.md'), 'new'); fs.writeFileSync(path.join(source, 'b.md'), 'changed');
  fs.writeFileSync(path.join(destination, 'b.md'), 'old'); fs.writeFileSync(path.join(destination, 'keep.md'), 'keep');
  assert.throws(() => copySelection(source, destination), /기존 파일/);
  assert.equal(fs.existsSync(path.join(destination, 'a.md')), false);
  assert.equal(fs.readFileSync(path.join(destination, 'b.md'), 'utf8'), 'old');
  copySelection(source, destination, { replace: true });
  assert.equal(fs.readFileSync(path.join(destination, 'keep.md'), 'utf8'), 'keep');
});

test('개인 설정은 배포 파일과 분리하고 명시적 요청 없이 바꾸지 않는다', t => {
  const f = fixture(t); const filename = path.join(f.root, 'settings/config.json');
  assert.equal(main(['configure', '--repo', 'example/docs', '--config', filename]).status, 'configured');
  assert.equal(main(['configure', '--repo', 'example/docs', '--config', filename]).status, 'unchanged');
  assert.throws(() => main(['configure', '--repo', 'other/docs', '--config', filename]), /기존 설정/);
  assert.deepEqual(JSON.parse(fs.readFileSync(filename)), config);
  assert.throws(() => main(['configure', '--repo', '../docs', '--config', filename, '--replace']));
});

test('폴더에 포함된 비밀 파일을 부분 업로드하지 않는다', t => {
  const f = fixture(t); const source = path.join(f.root, 'source'); fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'a.md'), '문서'); fs.writeFileSync(path.join(source, '.env'), 'SECRET=example');
  f.checkout(c => {
    const before = head(c);
    assert.throws(() => upload(c, config, source, 'docs/import'), /업로드 제외/);
    assert.equal(head(c), before);
    assert.equal(fs.existsSync(path.join(c, 'docs/import/a.md')), false);
  });
});
