/**
 * capture-commit-session 훅 회귀 테스트(zero-dep, node:test).
 * 실행: node scripts/validate-all.js (전체 검증) · node --test <파일경로> (이 파일만)
 *
 * 훅을 자식 프로세스로 띄우고 stdin 으로 실제 hook JSON 을 먹인 뒤 **부수효과**로 판정한다.
 * 이 훅은 어떤 경우에도 exit 0 이므로(커밋을 막지 않는다는 계약) 종료코드로는 아무것도
 * 구분되지 않는다 — 그래서 큐(queue.jsonl)에 무엇이 적재됐는지와 skip 사유 로그
 * (errors.jsonl)를 함께 본다. skip 을 로그로 확인하는 이유: "큐가 비었다"만 보면 의도한
 * 가드가 걸린 건지 엉뚱한 데서 죽은 건지 구분할 수 없다.
 *
 * 격리는 두 환경변수로 한다.
 *   - AGENT_FACTORY_HOME: 큐·커서·로그를 테스트 전용 디렉터리로 보낸다.
 *   - HOME: transcript_path 가 없을 때의 폴백이 `~/.claude/projects` 전체를 훑으므로,
 *     사용자의 진짜 홈을 스캔하지 않도록 빈 디렉터리로 돌린다.
 *
 * 케이스의 출처는 capture-commit-session.mjs 의 주석과 git 이력이다. 특히 GIT_COMMIT_RE
 * 는 두 번 회귀했다(75dd9b9, 883db32) — `git -C <repo> commit` 과 개행 구분자가 그때
 * 누락시킨 형태이며 아래에 케이스로 고정돼 있다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), "capture-commit-session.mjs");

// 호스트의 전역·시스템 gitconfig 를 끊는다. gpgsign·hooksPath·templatedir 이 새어들면
// 케이스가 아니라 실행 환경 때문에 픽스처 생성이 깨진다. 커밋 신원도 `git config` 호출
// 대신 환경변수로 준다 — 케이스마다 레포를 새로 만들므로 프로세스 spawn 수가 곧 실행시간이다.
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
};

function git(cwd, args, extraEnv = {}) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    env: { ...process.env, ...GIT_ENV, ...extraEnv },
  }).trim();
}

/** 빈 커밋을 하나 만든다. agoSec 을 주면 그만큼 과거 시각으로 찍는다(가드2 검증용). */
function commitEmpty(dir, message, { agoSec = 0 } = {}) {
  const env = agoSec
    ? (() => {
        const when = `${Math.floor(Date.now() / 1000) - agoSec} +0000`;
        return { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when };
      })()
    : {};
  git(dir, ["commit", "-q", "--allow-empty", "-m", message], env);
  return git(dir, ["rev-parse", "HEAD"]);
}

function makeRepo(root, name, { agoSec = 0 } = {}) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ["init", "-q", "-b", "main"]);
  commitEmpty(dir, "init", { agoSec });
  // 훅이 rev-parse 로 얻을 git root 와 그대로 비교할 수 있어야 한다. root 는 sandbox 에서
  // 이미 realpath 를 거쳤으므로(macOS /var → /private/var) 여기서 rev-parse 를 또 부르지
  // 않아도 같은 값이다.
  return dir;
}

/** 케이스마다 완전히 새 홈·새 레포를 준비한다 — 커서가 남아 케이스끼리 간섭하지 않도록. */
function sandbox(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "af-hook-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const fakeHome = path.join(root, "home");
  fs.mkdirSync(fakeHome, { recursive: true });

  const transcript = path.join(root, "session.jsonl");
  fs.writeFileSync(
    transcript,
    [
      JSON.stringify({ uuid: "u-1", type: "user" }),
      JSON.stringify({ uuid: "u-2", type: "assistant" }),
    ].join("\n") + "\n",
  );

  return { root, home: path.join(root, "factory-home"), fakeHome, transcript };
}

function runHookRaw(sb, stdin, { env = {} } = {}) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, AGENT_FACTORY_HOME: sb.home, HOME: sb.fakeHome, ...env },
  });
  // 이 훅의 최상위 계약. 어떤 케이스에서도 예외 없이 성립해야 하므로 헬퍼에서 못 박는다.
  assert.equal(res.status, 0, `훅은 항상 exit 0 이어야 한다 (stderr: ${res.stderr})`);
  return res;
}

function runHook(sb, { command, cwd, sessionId = "sess-1", transcript = sb.transcript }, opts) {
  const input = { session_id: sessionId, cwd, transcript_path: transcript, tool_name: "Bash" };
  // command 를 명시적으로 undefined 로 주면 tool_input 자체를 뺀다('불확실' 경로 검증).
  if (command !== undefined) input.tool_input = { command };
  return runHookRaw(sb, JSON.stringify(input), opts);
}

function readJsonl(file) {
  try {
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

const queue = (sb) => readJsonl(path.join(sb.home, "queue.jsonl"));
const skipLog = (sb) =>
  readJsonl(path.join(sb.home, "errors.jsonl"))
    .map((e) => e.detail)
    .join("\n");

// ── 가드3 (GIT_COMMIT_RE) — 커밋으로 인정돼야 하는 형태 ───────────────────────────
// 훅 주석 :76-83 이 "이 형태를 놓치면 커밋이 통째로 누락된다"고 밝힌 목록이 그대로 케이스다.

const COMMIT_FORMS = [
  ["단독 커밋", (r) => `git commit -m "x"`],
  ["&&-체인", (r) => `git add . && git commit -m "x"`],
  ["개행 구분 스크립트", (r) => `cd ${r}\ngit add .\ngit commit -m "x"`],
  [";-구분", (r) => `git add . ; git commit -m "x"`],
  ["-C 전역옵션 (883db32 회귀)", (r) => `git -C ${r} commit -m "x"`],
  ["-c 전역옵션", (r) => `git -c user.name=t commit -m "x"`],
  ["--long 전역옵션", (r) => `git --no-pager commit -m "x"`],
  ["단축 플래그 결합", (r) => `git commit -am "x"`],
  ["커밋 메시지에 다른 git 명령 언급", (r) => `git commit -m "fix: git push 가드"`],
];

for (const [label, build] of COMMIT_FORMS) {
  test(`가드3: 커밋으로 인정한다 — ${label}`, (t) => {
    const sb = sandbox(t);
    const repo = makeRepo(sb.root, "repo");
    runHook(sb, { command: build(repo), cwd: repo });
    assert.equal(queue(sb).length, 1, `큐에 적재되지 않았다. skip 로그: ${skipLog(sb)}`);
  });
}

// ── 가드3 — 커밋이 아니어서 skip 돼야 하는 형태 ────────────────────────────────────
// 큐가 비었는지만 보면 "엉뚱한 데서 죽었다"와 구분이 안 되므로 skip 사유까지 확인한다.

const NON_COMMIT_FORMS = [
  "git status",
  "git log --oneline",
  "git push origin main",
  "git config commit.gpgsign false",
  "git stash",
  'echo "git commit -m x"',
];

for (const command of NON_COMMIT_FORMS) {
  test(`가드3: 커밋이 아니면 skip 한다 — ${command}`, (t) => {
    const sb = sandbox(t);
    const repo = makeRepo(sb.root, "repo");
    runHook(sb, { command, cwd: repo });
    assert.equal(queue(sb).length, 0, "커밋이 아닌데 적재됐다");
    assert.match(skipLog(sb), /git commit 아닌 명령에 발동/);
  });
}

// ── 적재 내용 ────────────────────────────────────────────────────────────────────

test("큐 항목이 세션·레포·델타 구간을 온전히 담는다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");
  const sha = git(repo, ["rev-parse", "HEAD"]);

  runHook(sb, { command: 'git commit -m "x"', cwd: repo, sessionId: "sess-A" });

  const [entry] = queue(sb);
  assert.equal(entry.session_id, "sess-A");
  assert.equal(entry.commit, sha);
  assert.equal(entry.git_root, repo);
  assert.equal(entry.jsonl_path, sb.transcript);
  assert.equal(entry.from_offset, 0);
  assert.equal(entry.from_uuid, null);
  assert.equal(entry.to_offset, fs.statSync(sb.transcript).size);
  assert.equal(entry.to_uuid, "u-2");
  assert.equal(entry.shrank, false);
  assert.equal(entry.processed, false);
});

test("델타 구간은 직전 커밋 워터마크에서 이어진다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");

  runHook(sb, { command: 'git commit -m "1"', cwd: repo });
  const firstEnd = queue(sb)[0].to_offset;

  // 세션이 이어지며 JSONL 이 자라고, 새 커밋이 생긴 상황.
  fs.appendFileSync(sb.transcript, JSON.stringify({ uuid: "u-3", type: "user" }) + "\n");
  commitEmpty(repo, "second");
  runHook(sb, { command: 'git commit -m "2"', cwd: repo });

  const entries = queue(sb);
  assert.equal(entries.length, 2);
  assert.equal(entries[1].from_offset, firstEnd, "두 번째 델타가 첫 커밋 끝에서 시작해야 한다");
  assert.equal(entries[1].from_uuid, "u-2");
  assert.equal(entries[1].to_uuid, "u-3");
});

test("JSONL 이 짧아지면(compact/clear) shrank 를 세우고 처음부터 다시 잡는다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");

  runHook(sb, { command: 'git commit -m "1"', cwd: repo });

  fs.writeFileSync(sb.transcript, JSON.stringify({ uuid: "u-new", type: "user" }) + "\n");
  commitEmpty(repo, "second");
  runHook(sb, { command: 'git commit -m "2"', cwd: repo });

  const entries = queue(sb);
  assert.equal(entries[1].shrank, true);
  assert.equal(entries[1].from_offset, 0, "축소되면 처음부터 다시 잡아야 한다");
});

// ── 중복 가드 ────────────────────────────────────────────────────────────────────

test("가드1: 같은 세션에서 HEAD 가 전진하지 않으면 적재하지 않는다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");

  runHook(sb, { command: 'git commit -m "x"', cwd: repo, sessionId: "sess-A" });
  runHook(sb, { command: 'git commit -m "x"', cwd: repo, sessionId: "sess-A" });

  assert.equal(queue(sb).length, 1);
  assert.match(skipLog(sb), /HEAD 미전진/);
});

test("가드1b: 세션이 달라도 같은 레포의 같은 HEAD 는 다시 적재하지 않는다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");

  runHook(sb, { command: 'git commit -m "x"', cwd: repo, sessionId: "sess-A" });
  runHook(sb, { command: 'git commit -m "x"', cwd: repo, sessionId: "sess-B" });

  assert.equal(queue(sb).length, 1, "세션 경계를 넘는 중복이 적재됐다");
  assert.match(skipLog(sb), /이미 캡처됨/);
});

test("FORCE_CAPTURE 는 중복 가드만 우회한다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");

  runHook(sb, { command: 'git commit -m "x"', cwd: repo });
  runHook(sb, { command: 'git commit -m "x"', cwd: repo }, { env: { AGENT_FACTORY_FORCE_CAPTURE: "1" } });

  assert.equal(queue(sb).length, 2);
});

test("FORCE_CAPTURE 로도 가드3(비-커밋)은 뚫리지 않는다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");

  runHook(sb, { command: "git status", cwd: repo }, { env: { AGENT_FACTORY_FORCE_CAPTURE: "1" } });

  assert.equal(queue(sb).length, 0);
});

// ── 가드2 (커밋 최신성) ──────────────────────────────────────────────────────────

test("가드2: HEAD 가 최신성 창 밖이면 적재하지 않는다", (t) => {
  const sb = sandbox(t);
  // 창은 300초. 1시간 전 커밋이 HEAD 인 레포는 '방금 만든 커밋'이 아니다.
  const repo = makeRepo(sb.root, "repo", { agoSec: 3600 });

  runHook(sb, { command: 'git commit -m "x"', cwd: repo });

  assert.equal(queue(sb).length, 0, "오래된 HEAD 로 유령 기록이 만들어졌다");
  assert.match(skipLog(sb), /HEAD 커밋이 오래됨/);
});

test("가드2 는 명령이 git commit 으로 확정돼도 건너뛰지 않는다(오귀속 방지)", (t) => {
  const sb = sandbox(t);
  const stale = makeRepo(sb.root, "stale", { agoSec: 3600 });

  // 명시적 -C 로 대상이 확정된 형태여도 그 레포의 HEAD 가 오래됐으면 막아야 한다.
  runHook(sb, { command: `git -C ${stale} commit -m "x"`, cwd: stale });

  assert.equal(queue(sb).length, 0);
  assert.match(skipLog(sb), /HEAD 커밋이 오래됨/);
});

// ── 커밋 대상 레포 해석 (parseCommitTargetDir) ───────────────────────────────────

test("git -C <repo> 가 세션 cwd 보다 우선한다", (t) => {
  const sb = sandbox(t);
  const a = makeRepo(sb.root, "repo-a");
  const b = makeRepo(sb.root, "repo-b");

  runHook(sb, { command: `git -C ${b} commit -m "x"`, cwd: a });

  assert.equal(queue(sb)[0].git_root, b, "세션 cwd 레포로 오귀속됐다");
});

test("선행 cd 체인이 세션 cwd 보다 우선한다", (t) => {
  const sb = sandbox(t);
  const a = makeRepo(sb.root, "repo-a");
  const b = makeRepo(sb.root, "repo-b");

  runHook(sb, { command: `cd ${b} && git add . && git commit -m "x"`, cwd: a });

  assert.equal(queue(sb)[0].git_root, b);
});

test("상대 경로 cd 는 세션 cwd 기준으로 절대화된다", (t) => {
  const sb = sandbox(t);
  const a = makeRepo(sb.root, "repo-a");
  const b = makeRepo(sb.root, "repo-b");

  runHook(sb, { command: `cd ../repo-b && git commit -m "x"`, cwd: a });

  assert.equal(queue(sb)[0].git_root, b);
});

test("해석 불가한 경로(셸 변수)는 cwd 로 물러선다", (t) => {
  const sb = sandbox(t);
  const a = makeRepo(sb.root, "repo-a");
  makeRepo(sb.root, "repo-b");

  // 확인 못 한 경로로 잘못 귀속하느니 cwd 폴백 + 가드2 에 맡긴다(훅 :107-110 의 트레이드오프).
  runHook(sb, { command: `cd $TARGET && git commit -m "x"`, cwd: a });

  assert.equal(queue(sb)[0].git_root, a);
});

test("명시 경로가 git 레포가 아니면 cwd 로 물러선다", (t) => {
  const sb = sandbox(t);
  const a = makeRepo(sb.root, "repo-a");
  const notRepo = path.join(sb.root, "plain-dir");
  fs.mkdirSync(notRepo);

  runHook(sb, { command: `git -C ${notRepo} commit -m "x"`, cwd: a });

  assert.equal(queue(sb)[0].git_root, a);
});

// ── 열화 환경 — "절대 커밋을 막지 않는다"는 계약 ──────────────────────────────────
// runHookRaw 가 모든 케이스에서 exit 0 을 단언하므로, 아래는 그 위에 "조용히 포기하고
// 사유를 남기는가"를 덧붙여 본다.

test("stdin JSON 이 깨져도 죽지 않는다", (t) => {
  const sb = sandbox(t);
  runHookRaw(sb, "{ this is not json");
  assert.equal(queue(sb).length, 0);
});

test("stdin 이 비어 있어도 죽지 않는다", (t) => {
  const sb = sandbox(t);
  runHookRaw(sb, "");
  assert.equal(queue(sb).length, 0);
});

test("session_id 가 없으면 조용히 포기한다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");
  runHookRaw(
    sb,
    JSON.stringify({ cwd: repo, transcript_path: sb.transcript, tool_input: { command: "git commit -m x" } }),
  );
  assert.equal(queue(sb).length, 0);
});

test("세션 JSONL 을 찾지 못하면 사유를 남기고 포기한다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");

  runHook(sb, { command: 'git commit -m "x"', cwd: repo, transcript: path.join(sb.root, "없음.jsonl") });

  assert.equal(queue(sb).length, 0);
  assert.match(skipLog(sb), /세션 JSONL 을 찾지 못함/);
});

test("git 이 PATH 에 없어도 죽지 않는다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");

  runHook(sb, { command: 'git commit -m "x"', cwd: repo }, { env: { PATH: path.join(sb.root, "empty-bin") } });

  assert.equal(queue(sb).length, 0);
  assert.match(skipLog(sb), /git root 를 찾지 못함/);
});

test("cwd 가 git 레포가 아니어도 죽지 않는다", (t) => {
  const sb = sandbox(t);
  const plain = path.join(sb.root, "plain");
  fs.mkdirSync(plain);

  runHook(sb, { command: 'git commit -m "x"', cwd: plain });

  assert.equal(queue(sb).length, 0);
  assert.match(skipLog(sb), /git root 를 찾지 못함/);
});

test("AGENT_FACTORY_HOME 을 만들 수 없어도 죽지 않는다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");
  // 홈 경로 자리에 파일을 놓아 mkdir 을 실패시킨다.
  fs.mkdirSync(path.dirname(sb.home), { recursive: true });
  fs.writeFileSync(sb.home, "not a directory");

  runHook(sb, { command: 'git commit -m "x"', cwd: repo });

  assert.equal(fs.readFileSync(sb.home, "utf8"), "not a directory", "홈 경로를 덮어썼다");
});

test("세션 id 가 예약 키(repos)면 커서를 덮어쓰지 않고 포기한다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");

  runHook(sb, { command: 'git commit -m "x"', cwd: repo, sessionId: "repos" });

  assert.equal(queue(sb).length, 0);
  assert.match(skipLog(sb), /예약 키/);
});

test("tool_input 이 없으면 '불확실'로 두고 가드2 백스톱에 맡긴다", (t) => {
  const sb = sandbox(t);
  const repo = makeRepo(sb.root, "repo");

  // 증거 없음을 커밋 누락의 근거로 삼지 않는다 — 최신 HEAD 이므로 적재돼야 한다.
  runHook(sb, { command: undefined, cwd: repo });

  assert.equal(queue(sb).length, 1);
});

test("tool_input 이 없고 HEAD 도 오래됐으면 가드2 가 받아낸다", (t) => {
  const sb = sandbox(t);
  const stale = makeRepo(sb.root, "stale", { agoSec: 3600 });

  runHook(sb, { command: undefined, cwd: stale });

  assert.equal(queue(sb).length, 0);
  assert.match(skipLog(sb), /HEAD 커밋이 오래됨/);
});
