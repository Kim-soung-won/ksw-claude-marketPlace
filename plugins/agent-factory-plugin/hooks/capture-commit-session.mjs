#!/usr/bin/env node
/**
 * capture-commit-session — 경량 커밋 캡처 hook (PostToolUse @ Bash(git commit *)).
 *
 * 무조건 실행되는 hook이므로 규칙은 단 하나다: **가볍고, 절대 커밋을 막지 않는다.**
 * LLM을 부르지 않고, 세션 JSONL도 통째로 읽지 않는다. 하는 일은:
 *   1. stdin hook JSON에서 session_id·cwd·transcript_path·tool_input 을 읽는다.
 *   2. 방금 성사된 커밋 sha와 커밋된 레포의 git root를 구한다.
 *   3. **4중 가드로 실제 새 커밋인지 검증한다** — (가드3) 트리거 명령이 정말
 *      git commit 인지, (가드1) HEAD 가 이 세션의 마지막 캡처 sha 에서 전진했는지,
 *      (가드1b) 같은 레포에서 이 sha 를 다른 세션이 이미 캡처하지 않았는지,
 *      (가드2) 명령으로 확정 못 한 경우 HEAD 커밋이 방금 만들어졌는지. 하나라도
 *      걸리면 큐에 적재하지 않고 조용히 종료한다(유령 커밋 기록 방지).
 *
 *      가드1b 가 따로 필요한 이유: 세션 커서는 session_id 로만 키잉되므로 새 세션에서는
 *      prev.commit 이 null 이라 가드1 이 그대로 통과한다. 실제로 한 커밋이 서로 다른
 *      세션에서 2~7회 중복 적재된 사례가 관측됐다. 레포 스코프 커서가 그 경계를 넘는다.
 *   4. 세션 JSONL의 "현재 끝"(byte offset + 마지막 event uuid)을 워터마크로 읽는다.
 *   5. 직전 커밋 워터마크와의 **델타 구간**을 큐에 적재한다.
 *   6. 워터마크(오프셋·uuid·커밋 sha)를 현재 끝으로 갱신한다.
 * 어떤 단계가 실패해도 조용히 넘어가고 항상 exit 0 한다. skip 사유는 errors.jsonl 로그로 남긴다.
 *
 * 델타 구간 단위가 핵심이다: 한 세션에서 프롬프트·커밋을 계속 이어가도, 각 커밋은
 * "직전 커밋 이후 ~ 이번 커밋"만 담아 커밋 간 중복 오염이 없다.
 *
 * **이 훅은 작업 레포에 아무것도 쓰지 않는다.** 워터마크·큐는 사용자 레벨
 * (`~/.agent-factory/`)에 둔다 — 근거는 lib/factory-home.mjs 참조.
 *
 * cursors.json 스키마: 최상위에 세션 UUID 키와 예약 키 `repos` 가 공존한다.
 * `repos[<git_root>] = { last_commit, last_session_id, updated_at }` 이며, 세션별
 * offset 워터마크는 델타 구간 계산에 필요하므로 그대로 유지된다. 가드1b 는 return 만
 * 하므로 중복 캡처가 걸려도 세션 워터마크는 전진하지 않고, 그 사이 작업 델타는 해당
 * 세션의 다음 진짜 커밋이 온전히 이어받는다.
 *
 * 같은 HEAD 를 의도적으로 다시 캡처해야 하면 `AGENT_FACTORY_FORCE_CAPTURE=1` 로
 * 중복 가드만 우회한다(가드2·가드3 은 우회되지 않는다).
 *
 * JSONL 구조(uuid·마지막 event 등)의 근거는 claude-code-docs-plugin의
 * claude-code-jsonl 스킬이고, hook 입력 필드(`transcript_path` 등)의 근거는
 * 같은 플러그인의 claude-code-hooks 스킬이다.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  CURSORS_PATH,
  CURSORS_REPO_NS,
  QUEUE_PATH,
  appendLog,
  ensureHome,
  readJson,
  writeJson,
} from "../lib/factory-home.mjs";

// 가드2(커밋 최신성 백스톱)의 창. HEAD 커밋의 committer 시각이 지금으로부터 이 초 이내가
// 아니면 방금 만든 커밋이 아니라고 본다. 훅 발동 지연·느린 pre-commit 체인을 고려한 여유값
// 이며 실측으로 튜닝 가능하다. 명령으로 git commit 임이 확정되면 이 검사 자체를 건너뛴다.
const COMMIT_RECENCY_WINDOW_SEC = 300;

// 트리거 명령이 실제 git commit 실행인지 판정한다. 복합 명령(`git add . && git commit …`)도
// 매칭되도록 명령 시작·구분자(;·&·|) 뒤의 `git commit` 을 본다.
const GIT_COMMIT_RE = /(^|[;&|]\s*)git\s+commit\b/;

// 같은 HEAD 를 의도적으로 다시 캡처하고 싶을 때의 탈출구. 중복 가드(가드1·가드1b)만
// 우회하며, 가드2·가드3(진짜 커밋인지 검증)은 우회하지 않는다 — 유령 커밋 방지는
// 어떤 경우에도 풀지 않는다.
const forceCapture =
  process.env.AGENT_FACTORY_FORCE_CAPTURE === "1" ||
  process.env.AGENT_FACTORY_FORCE_CAPTURE === "true";

function safeGit(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * 세션 JSONL 경로를 구한다.
 *
 * 훅 입력의 `transcript_path` 가 정답이다(모든 훅에 제공되는 공통 필드). 예전
 * 버전이나 예외 상황에 대비해서만 이름 탐색으로 물러선다 — 이 폴백은 프로젝트
 * 디렉터리 전체를 훑으므로 세션이 쌓이면 비싸다.
 */
function resolveTranscript(transcriptPath, sessionId) {
  if (transcriptPath && fs.existsSync(transcriptPath)) return transcriptPath;
  if (!sessionId) return null;
  return findSessionJsonl(path.join(os.homedir(), ".claude", "projects"), `${sessionId}.jsonl`);
}

/** 폴백 전용: `${sessionId}.jsonl`을 이름으로 찾는다(경로 인코딩이 손실적이라 이름 탐색이 견고). */
function findSessionJsonl(root, fileName) {
  let stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.name === fileName) {
        return full;
      }
    }
  }
  return null;
}

/** 파일 마지막 비어있지 않은 JSON 라인의 uuid를 반환한다. */
function lastUuid(file) {
  try {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        return JSON.parse(line).uuid ?? null;
      } catch {
        return null;
      }
    }
  } catch {
    /* noop */
  }
  return null;
}

function main() {
  const raw = fs.readFileSync(0, "utf8");
  const input = JSON.parse(raw);

  const sessionId = input.session_id;
  const cwd = input.cwd || process.cwd();
  if (!sessionId) return;

  // 가드3 — 트리거 명령 재확인(심층 방어). if 게이트가 비-커밋 Bash 에 새더라도 여기서
  // 막는다. command 가 있는데 git commit 이 아니면 즉시 skip. command 가 없거나 문자열이
  // 아니면(스키마 변형·구버전) '불확실'로 두고 통과시킨다 — 증거 없음을 커밋 누락의
  // 근거로 삼지 않는다. 이 '불확실'은 아래 가드2(최신성)가 백스톱으로 받는다.
  const command =
    input.tool_input && typeof input.tool_input.command === "string"
      ? input.tool_input.command
      : null;
  let commandConfirmsCommit = false;
  if (command !== null) {
    if (GIT_COMMIT_RE.test(command)) {
      commandConfirmsCommit = true;
    } else {
      appendLog("capture", `git commit 아닌 명령에 발동 — skip (cmd=${command.slice(0, 80)})`);
      return;
    }
  }

  const jsonlPath = resolveTranscript(input.transcript_path, sessionId);
  if (!jsonlPath) {
    appendLog("capture", `세션 JSONL 을 찾지 못함 (session=${sessionId})`);
    return;
  }

  const gitRoot = safeGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (!gitRoot) {
    appendLog("capture", `git root 를 찾지 못함 (cwd=${cwd})`);
    return;
  }
  const commit = safeGit(cwd, ["rev-parse", "HEAD"]) || "";
  const commitMessage = commit
    ? safeGit(cwd, ["log", "-1", "--pretty=%B", commit]) || ""
    : "";

  if (!ensureHome()) return;

  // 세션 키와 예약 키가 한 최상위 네임스페이스를 공유하므로, 세션 id 가 예약 키와
  // 같으면(정상 상황에선 세션 id 가 UUID 라 발생하지 않는다) repos 버킷을 세션 커서로
  // 덮어쓰는 사고가 난다. 그 경우는 캡처를 포기한다.
  if (sessionId === CURSORS_REPO_NS) {
    appendLog("capture", `세션 id 가 예약 키(${CURSORS_REPO_NS}) — skip`);
    return;
  }

  const cursors = readJson(CURSORS_PATH(), {}) || {};
  const prevRaw = cursors[sessionId];
  const prev =
    prevRaw && typeof prevRaw === "object" && !Array.isArray(prevRaw)
      ? prevRaw
      : { offset: 0, uuid: null, commit: null };

  // 레포 스코프 커서. `repos` 키가 없는 예전 파일에서 시작해도 빈 객체로 출발해
  // 첫 캡처 때 자연 생성된다 — backfill 스크립트나 파일 재작성은 하지 않는다(훅 경량 계약).
  const repoNsRaw = cursors[CURSORS_REPO_NS];
  const repoCursors =
    repoNsRaw && typeof repoNsRaw === "object" && !Array.isArray(repoNsRaw)
      ? repoNsRaw
      : {};

  // 가드1 — HEAD 전진 검증. 이 세션이 마지막으로 캡처한 커밋에서 HEAD 가 움직이지 않았으면
  // (같은 sha) 새 커밋이 아니므로 적재하지 않는다. 아래 append·커서 갱신에 도달하지 않아
  // 오프셋 워터마크가 전진하지 않고, 다음 진짜 커밋이 직전 실커밋 이후 델타 전체를 이어받는다.
  if (commit && prev.commit && commit === prev.commit && !forceCapture) {
    appendLog("capture", `HEAD 미전진(${commit.slice(0, 7)}) — skip (session=${sessionId})`);
    return;
  }

  // 가드1b — 레포 스코프 중복 검증. 가드1 의 커서는 session_id 로만 키잉되므로, 새 세션은
  // prev.commit 이 null 이라 같은 HEAD 여도 그대로 통과한다. 실제로 한 커밋이 서로 다른
  // 세션에서 2~7회 중복 적재된 사례가 관측됐다. 레포별 마지막 캡처 sha 를 함께 보아
  // 세션 경계를 넘는 중복을 막는다. gitRoot·commit 은 위에서 이미 구했으므로 추가 git
  // 호출이 없고, 가드2(커밋 최신성)보다 앞서 두어 중복 케이스에선 git log 호출조차 생략된다.
  const repoCursor = repoCursors[gitRoot];
  const repoLastCommit =
    repoCursor && typeof repoCursor === "object" ? repoCursor.last_commit : null;
  if (commit && repoLastCommit && commit === repoLastCommit && !forceCapture) {
    appendLog(
      "capture",
      `HEAD 이미 캡처됨(repo:${commit.slice(0, 7)}) — skip ` +
        `(session=${sessionId}, root=${gitRoot}, prev_session=${repoCursor.last_session_id ?? "?"})`,
    );
    return;
  }

  if (forceCapture && commit) {
    appendLog("capture", `FORCE_CAPTURE — 중복 가드 우회 (${commit.slice(0, 7)})`);
  }

  // 가드2 — 커밋 최신성 백스톱. 명령으로 커밋을 확정한 경우엔 건너뛴다(커밋 뒤 긴 작업이
  // 이어진 한 줄 명령에서 훅이 늦게 발동해도 진짜 커밋을 놓치지 않기 위함). 명령이 '불확실'
  // 할 때만, HEAD 커밋의 committer 시각이 창 밖이면 방금 만든 게 아니므로 skip한다. 시각을
  // 확인할 수 없으면(불확실 + 증거 없음) 보수적으로 skip한다 — 유령 기록을 만들지 않는다.
  if (!commandConfirmsCommit) {
    const ctRaw = commit ? safeGit(cwd, ["log", "-1", "--format=%ct", commit]) : null;
    const ct = ctRaw ? parseInt(ctRaw, 10) : NaN;
    if (Number.isNaN(ct)) {
      appendLog("capture", `HEAD 커밋 시각 확인 불가 — skip (session=${sessionId})`);
      return;
    }
    const ageSec = Math.floor(Date.now() / 1000) - ct;
    if (ageSec > COMMIT_RECENCY_WINDOW_SEC) {
      appendLog("capture", `HEAD 커밋이 오래됨(${ageSec}s) — skip (session=${sessionId})`);
      return;
    }
  }

  const stat = fs.statSync(jsonlPath);
  const toOffset = stat.size;
  const toUuid = lastUuid(jsonlPath);

  // 파일이 직전 워터마크보다 짧아졌으면(재작성/compaction) 처음부터 다시 잡는다.
  // 이 축소는 곧 세션 리셋(compact/clear) 신호다 — stat 으로 이미 잡은 offset 비교뿐이라
  // JSONL 내용을 읽지 않는다(훅 경량 계약 유지). 리셋의 '집계'는 distill 이 맡고, 훅은
  // 사실(shrank) 1비트만 방출한다.
  const shrank = toOffset < prev.offset;
  const fromOffset = toOffset >= prev.offset ? prev.offset : 0;
  const fromUuid = toOffset >= prev.offset ? prev.uuid : null;

  const capturedAt = new Date().toISOString();
  const entry = {
    session_id: sessionId,
    commit,
    commit_message: commitMessage,
    jsonl_path: jsonlPath,
    from_offset: fromOffset,
    from_uuid: fromUuid,
    to_offset: toOffset,
    to_uuid: toUuid,
    cwd,
    // 큐가 사용자 레벨로 모이므로 어느 레포의 델타인지 항목이 스스로 밝혀야 한다.
    git_root: gitRoot,
    // 세션 리셋(compact/clear) 신호. distill 이 커밋 간 누적 리셋으로 집계한다.
    shrank,
    captured_at: capturedAt,
    processed: false,
  };
  fs.appendFileSync(QUEUE_PATH(), JSON.stringify(entry) + "\n");

  // 커밋 sha 를 워터마크에 함께 저장해 다음 발동의 가드1(HEAD 전진)이 이 세션의 마지막
  // 캡처 커밋을 알 수 있게 한다. git_root 는 진단용 additive 필드다(읽는 쪽 없음).
  cursors[sessionId] = {
    offset: toOffset,
    uuid: toUuid,
    commit,
    git_root: gitRoot,
    updated_at: capturedAt,
  };

  // 레포 커서는 sha 가 실제로 있을 때만 쓴다 — 빈 sha 를 적어두면 이후 캡처를 잘못 막는다.
  if (commit) {
    repoCursors[gitRoot] = {
      last_commit: commit,
      last_session_id: sessionId,
      updated_at: capturedAt,
    };
    cursors[CURSORS_REPO_NS] = repoCursors;
  }

  // 쓰기는 여전히 1회. 실패해도 던지지 않으므로(false 반환) 관측만 남기고 넘어간다 —
  // 커서가 전진하지 못하면 다음 캡처가 중복될 수 있다는 사실이 진단에 필요하다.
  if (!writeJson(CURSORS_PATH(), cursors)) {
    appendLog(
      "capture",
      `커서 저장 실패 — 다음 캡처가 중복될 수 있음 (${commit ? commit.slice(0, 7) : "?"})`,
    );
  }
}

try {
  main();
} catch (err) {
  // 커밋은 막지 않되(항상 exit 0), 왜 캡처가 실패했는지는 로그로 남긴다.
  appendLog("capture", `fatal: ${err}`);
} finally {
  process.exit(0);
}
