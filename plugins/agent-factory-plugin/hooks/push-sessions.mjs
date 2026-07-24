#!/usr/bin/env node
/**
 * push-sessions — 세션 기록 업로드 hook (Stop).
 *
 * 작업 레포의 `.agent-factory/sessions/<sha>.md` 중 **아직 안 보냈거나 내용이 바뀐
 * 것만** 골라 Observer 서버로 POST 한다. capture-commit-session(커밋 시점)과 역할이
 * 다르다: 요약 .md 는 summarizer 가 나중에 쓰므로 커밋 훅에서는 보낼 것이 아직 없다.
 * 그래서 세션이 끝나는 Stop 시점에 모아서 민다.
 *
 * 커밋 훅과 같은 규칙을 지킨다: **가볍고, 절대 흐름을 막지 않는다.**
 * 서버가 죽어 있어도, 설정이 없어도 조용히 넘어가고 항상 exit 0 한다.
 *
 * **작업 레포에서 읽기만 한다.** 전송 상태와 토큰은 사용자 레벨(`~/.agent-factory/`)에
 * 둔다 — 근거는 lib/factory-home.mjs 참조.
 *
 * 설정: `~/.agent-factory/config.json` 에 `{ "apiBase": "...", "token": "..." }`
 * (또는 OBSERVER_API_BASE / OBSERVER_TOKEN 환경변수). 둘 다 없으면 아무것도 하지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  STATE_PATH,
  ensureHome,
  loadConfig,
  readJson,
  stateKey,
  writeJson,
} from "../lib/factory-home.mjs";

/** 세션 종료를 몇 초씩 붙잡지 않도록 짧게 끊는다. */
const TIMEOUT_MS = 5000;
/** 한 번에 보낼 기록 수 상한(서버 MAX_BATCH 와 맞춘다). */
const MAX_BATCH = 50;

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

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

async function main() {
  const raw = fs.readFileSync(0, "utf8");
  const input = JSON.parse(raw);
  const cwd = input.cwd || process.cwd();

  const { apiBase, token } = loadConfig();
  if (!apiBase || !token) return;

  const gitRoot = safeGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (!gitRoot) return;

  const sessionsDir = path.join(gitRoot, ".agent-factory", "sessions");
  if (!fs.existsSync(sessionsDir)) return;

  if (!ensureHome()) return;
  const state = readJson(STATE_PATH(), {}) || {};

  let files;
  try {
    files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".md"));
  } catch {
    return;
  }

  const projectName = path.basename(gitRoot);
  const remoteUrl = safeGit(gitRoot, ["config", "--get", "remote.origin.url"]);
  const userIdentifier = safeGit(gitRoot, ["config", "--get", "user.email"]);
  const userDisplayName = safeGit(gitRoot, ["config", "--get", "user.name"]);

  const pending = [];
  for (const fileName of files) {
    let markdown;
    try {
      markdown = fs.readFileSync(path.join(sessionsDir, fileName), "utf8");
    } catch {
      continue;
    }
    // 이미 같은 내용으로 보낸 파일은 건너뛴다(서버도 멱등이지만 트래픽을 아낀다).
    const hash = sha256(markdown);
    if (state[stateKey(gitRoot, fileName)] === hash) continue;

    pending.push({
      key: stateKey(gitRoot, fileName),
      hash,
      payload: {
        markdown,
        fileName,
        projectPath: gitRoot,
        projectName,
        remoteUrl: remoteUrl || undefined,
        userIdentifier: userIdentifier || undefined,
        userDisplayName: userDisplayName || undefined,
      },
    });
  }

  if (pending.length === 0) return;

  // 상한을 넘으면 나머지는 다음 Stop 에서 보낸다(상태를 안 찍었으므로 자연히 재시도된다).
  for (let i = 0; i < pending.length; i += MAX_BATCH) {
    const chunk = pending.slice(i, i + MAX_BATCH);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response;
    try {
      response = await fetch(`${apiBase.replace(/\/$/, "")}/api/agent-factory/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ records: chunk.map((p) => p.payload) }),
        signal: controller.signal,
      });
    } catch {
      break; // 네트워크 실패 — 상태를 안 찍었으니 다음에 다시 시도된다
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) break;

    const body = await response.json().catch(() => null);
    const results = body?.data?.results;
    if (!Array.isArray(results)) break;

    // 실제로 서버가 받아들인 건만 전송 완료로 찍는다. skipped 는 다시 시도한다.
    chunk.forEach((p, idx) => {
      const outcome = results[idx]?.outcome;
      if (outcome && outcome !== "skipped") {
        state[p.key] = p.hash;
      }
    });
  }

  writeJson(STATE_PATH(), state);
}

main()
  .catch(() => {
    /* 절대 세션 종료를 막지 않는다 */
  })
  .finally(() => process.exit(0));
