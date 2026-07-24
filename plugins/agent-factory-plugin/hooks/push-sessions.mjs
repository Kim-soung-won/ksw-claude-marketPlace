#!/usr/bin/env node
/**
 * push-sessions — 세션 기록 업로드 hook (Stop).
 *
 * 사용자 레벨 `~/.agent-factory/sessions/<projectSlug>/<sha>.md` 중 **아직 안 보냈거나
 * 내용이 바뀐 것만** 골라 Observer 서버로 POST 한다. capture-commit-session(커밋 시점)과
 * 역할이 다르다: 요약 .md 는 summarizer 가 나중에 쓰므로 커밋 훅에서는 보낼 것이 아직 없다.
 * 그래서 세션이 끝나는 Stop 시점에 모아서 민다.
 *
 * 커밋 훅과 같은 규칙을 지킨다: **가볍고, 절대 흐름을 막지 않는다.**
 * 서버가 죽어 있어도, 설정이 없어도 조용히 넘어가고 항상 exit 0 한다.
 *
 * **레포에는 아무것도 쓰지 않는다.** 세션 기록·계량치·전송 상태·토큰 모두 사용자 레벨
 * (`~/.agent-factory/`)에 있다 — 근거는 lib/factory-home.mjs 참조. 파일이 레포 밖에 있어
 * 어느 프로젝트인지 알아야 하므로, metrics.json(권위) 또는 .md frontmatter(폴백)의
 * project_path 로 프로젝트를 복원해 payload 로 보낸다(서버는 이 값으로 Project 를 정한다).
 *
 * 설정: `~/.agent-factory/config.json` 에 `{ "apiBase": "...", "token": "..." }`
 * (또는 OBSERVER_API_BASE / OBSERVER_TOKEN 환경변수). 둘 다 없으면 아무것도 하지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  SESSIONS_DIR,
  STATE_PATH,
  appendLog,
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

/** .md frontmatter 에서 한 필드를 읽는다(레포 밖 파일의 project 복원 폴백용). */
function frontmatterField(markdown, key) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!fm) return null;
  const line = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(fm[1]);
  if (!line) return null;
  return line[1].trim().replace(/^["']|["']$/g, "");
}

async function main() {
  // 세션 기록은 사용자 레벨에 모이므로 훅 입력의 cwd 는 스캔에 쓰지 않는다 — 이 머신의
  // 모든 프로젝트 기록을 한 번에 훑는다.
  const { apiBase, token } = loadConfig();
  if (!apiBase || !token) return;

  if (!ensureHome()) return;
  const sessionsRoot = SESSIONS_DIR();
  if (!fs.existsSync(sessionsRoot)) return;
  const state = readJson(STATE_PATH(), {}) || {};

  // 프로젝트별 하위 디렉터리(projectSlug)를 순회한다.
  let slugDirs;
  try {
    slugDirs = fs
      .readdirSync(sessionsRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(sessionsRoot, e.name));
  } catch {
    return;
  }

  const pending = [];
  for (const dir of slugDirs) {
    let files;
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    } catch {
      continue;
    }
    for (const fileName of files) {
      let markdown;
      try {
        markdown = fs.readFileSync(path.join(dir, fileName), "utf8");
      } catch {
        continue;
      }
      // 짝 계량치 사이드카(있으면). .md 와 같은 sha7 prefix 를 공유하므로 파일명에서
      // revision 접미사만 떼면 같은 디렉터리에서 찾을 수 있다.
      const metricsName = fileName.replace(/(-r\d+)?\.md$/, "") + ".metrics.json";
      let metrics;
      let metricsRaw = "";
      try {
        metricsRaw = fs.readFileSync(path.join(dir, metricsName), "utf8");
        metrics = JSON.parse(metricsRaw);
      } catch {
        /* 사이드카가 없거나 깨졌으면 계량치 없이 요약만 보낸다 */
      }

      // 파일이 레포 밖에 있으므로 어느 프로젝트인지 내용에서 복원한다:
      // metrics.project_path(권위) → .md frontmatter(폴백). 둘 다 없으면 서버가
      // Project 를 만들 수 없으므로 건너뛴다.
      const projectPath =
        (metrics && metrics.project_path) || frontmatterField(markdown, "project_path");
      if (!projectPath) continue;

      // 레포가 아직 그 자리에 있으면 git 신원·리모트를 보강한다. 없으면 metrics 폴백.
      const repoExists = safeGit(projectPath, ["rev-parse", "--show-toplevel"]);
      const projectName = repoExists
        ? path.basename(projectPath)
        : (metrics && metrics.project_name) || path.basename(projectPath);
      const remoteUrl = repoExists
        ? safeGit(projectPath, ["config", "--get", "remote.origin.url"])
        : null;
      const userIdentifier = repoExists
        ? safeGit(projectPath, ["config", "--get", "user.email"])
        : null;
      const userDisplayName = repoExists
        ? safeGit(projectPath, ["config", "--get", "user.name"])
        : null;

      // 이미 같은 내용으로 보낸 파일은 건너뛴다. 상태 키는 projectPath 기반이라
      // 이전 위치에서 보낸 기록의 상태가 그대로 유효하다(리셋 불필요).
      // 해시에 metrics 도 포함 — .md 는 그대로인데 계량치만 갱신된 경우도 재전송한다.
      const hash = sha256(markdown + " " + metricsRaw);
      if (state[stateKey(projectPath, fileName)] === hash) continue;

      pending.push({
        key: stateKey(projectPath, fileName),
        hash,
        // 전송 성공 시 로컬에서 지울 파일들(정리).
        mdPath: path.join(dir, fileName),
        metricsPath: metrics ? path.join(dir, metricsName) : null,
        dir,
        payload: {
          markdown,
          fileName,
          projectPath,
          projectName,
          remoteUrl: remoteUrl || undefined,
          userIdentifier: userIdentifier || undefined,
          userDisplayName: userDisplayName || undefined,
          metrics,
        },
      });
    }
  }

  if (pending.length === 0) return;

  // 전송에 성공(created/updated/unchanged)한 항목 — 루프 뒤에서 로컬 파일을 정리한다.
  const succeeded = [];

  // 상한을 넘으면 나머지는 다음 호출에서 보낸다(상태를 안 찍었으므로 자연히 재시도된다).
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
    } catch (err) {
      appendLog("push", `network 실패: ${err}`); // 상태를 안 찍었으니 다음에 재시도된다
      break;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      appendLog("push", `서버 응답 ${response.status}`);
      break;
    }

    const body = await response.json().catch(() => null);
    const results = body?.data?.results;
    if (!Array.isArray(results)) {
      appendLog("push", "서버 응답 형식이 예상과 다름");
      break;
    }

    // 실제로 서버가 받아들인 건만 전송 완료로 찍는다. skipped 는 로컬에 남겨 재시도한다.
    chunk.forEach((p, idx) => {
      const outcome = results[idx]?.outcome;
      if (outcome && outcome !== "skipped") {
        state[p.key] = p.hash;
        succeeded.push(p);
      } else {
        appendLog("push", `서버가 거부(skipped): ${p.payload.fileName} — ${results[idx]?.reason ?? "사유 없음"}`);
      }
    });
  }

  writeJson(STATE_PATH(), state);

  // 정리: 전송 성공한 기록만 로컬에서 지운다. 서버 DB 가 진실의 원천이므로 로컬 사본은
  // 전송용 임시일 뿐이다. 실패·거부분은 남겨 다음 요약 때 push 가 재시도한다.
  const touchedDirs = new Set();
  for (const p of succeeded) {
    try {
      fs.unlinkSync(p.mdPath);
    } catch (err) {
      appendLog("push", `정리 실패(.md): ${p.mdPath} — ${err}`);
    }
    if (p.metricsPath) {
      try {
        fs.unlinkSync(p.metricsPath);
      } catch {
        /* metrics 는 없을 수도 있다 — 조용히 넘어간다 */
      }
    }
    touchedDirs.add(p.dir);
  }
  // 비게 된 projectSlug 디렉터리는 정리한다(rmdir 은 비어있을 때만 성공).
  for (const d of touchedDirs) {
    try {
      fs.rmdirSync(d);
    } catch {
      /* 남은 파일이 있으면 그대로 둔다 */
    }
  }
}

main()
  .catch((err) => {
    try {
      appendLog("push", `fatal: ${err}`);
    } catch {
      /* noop */
    }
  })
  .finally(() => process.exit(0));
