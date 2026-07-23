#!/usr/bin/env node
/**
 * capture-commit-session — 경량 커밋 캡처 hook (PostToolUse @ Bash(git commit *)).
 *
 * 무조건 실행되는 hook이므로 규칙은 단 하나다: **가볍고, 절대 커밋을 막지 않는다.**
 * LLM을 부르지 않고, 세션 JSONL도 통째로 읽지 않는다. 하는 일은:
 *   1. stdin hook JSON에서 session_id·cwd를 읽는다.
 *   2. 방금 성사된 커밋 sha와 커밋된 레포의 git root를 구한다.
 *   3. 세션 JSONL의 "현재 끝"(byte offset + 마지막 event uuid)을 워터마크로 읽는다.
 *   4. 직전 커밋 워터마크(.agent-factory/cursors.json)와의 **델타 구간**을 큐에 적재한다.
 *   5. 워터마크를 현재 끝으로 갱신한다.
 * 어떤 단계가 실패해도 조용히 넘어가고 항상 exit 0 한다.
 *
 * 델타 구간 단위가 핵심이다: 한 세션에서 프롬프트·커밋을 계속 이어가도, 각 커밋은
 * "직전 커밋 이후 ~ 이번 커밋"만 담아 커밋 간 중복 오염이 없다.
 *
 * JSONL 구조(uuid·마지막 event 등)의 근거는 claude-code-docs-plugin의
 * claude-code-jsonl 스킬이다.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

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

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** projects 디렉토리에서 `${sessionId}.jsonl`을 이름으로 찾는다(경로 인코딩이 손실적이므로 이름 탐색이 견고). */
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

  const projectsDir = path.join(os.homedir(), ".claude", "projects");
  const jsonlPath = findSessionJsonl(projectsDir, `${sessionId}.jsonl`);
  if (!jsonlPath) return;

  const gitRoot = safeGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (!gitRoot) return;
  const commit = safeGit(cwd, ["rev-parse", "HEAD"]) || "";
  const commitMessage = commit
    ? safeGit(cwd, ["log", "-1", "--pretty=%B", commit]) || ""
    : "";

  const factoryDir = path.join(gitRoot, ".agent-factory");
  fs.mkdirSync(factoryDir, { recursive: true });

  // 최초 생성 시 전이 상태(큐·커서)는 버전관리 대상이 아님을 표시한다.
  const gitignorePath = path.join(factoryDir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, "queue.jsonl\nprocessed.jsonl\ncursors.json\n");
  }

  const cursorsPath = path.join(factoryDir, "cursors.json");
  const queuePath = path.join(factoryDir, "queue.jsonl");

  const cursors = readJson(cursorsPath) || {};
  const prev = cursors[sessionId] || { offset: 0, uuid: null };

  const stat = fs.statSync(jsonlPath);
  const toOffset = stat.size;
  const toUuid = lastUuid(jsonlPath);

  // 파일이 직전 워터마크보다 짧아졌으면(재작성/compaction) 처음부터 다시 잡는다.
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
    captured_at: capturedAt,
    processed: false,
  };
  fs.appendFileSync(queuePath, JSON.stringify(entry) + "\n");

  cursors[sessionId] = { offset: toOffset, uuid: toUuid, updated_at: capturedAt };
  fs.writeFileSync(cursorsPath, JSON.stringify(cursors, null, 2));
}

try {
  main();
} catch {
  /* 절대 커밋을 막지 않는다 */
} finally {
  process.exit(0);
}
