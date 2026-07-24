/**
 * agent-factory 사용자 레벨 홈 — 훅·스크립트가 공유하는 경로·설정 계약.
 *
 * ## 왜 사용자 레벨인가
 *
 * 이 플러그인은 마켓플레이스로 배포돼 임의의 레포에서 돌아간다. 그래서 규칙은 하나다:
 * **자기 소유가 아닌 레포에 아무것도 쓰지 않는다.**
 *
 * 세션 요약 `.md`·계량치 `metrics.json`을 포함해 이 플러그인이 만드는 모든 파일은 레포가
 * 아니라 여기(머신당 1벌)에 둔다. 팀 공유는 Observer 서버 DB가 담당하므로 레포에 요약을
 * 커밋할 이유가 없다 — 레포 저장은 남의 레포 오염·개인 회고 프라이버시 노출·서버와의
 * 이중 저장·레포 간 분산만 낳는다. 그 결과 훅이 남의 레포에 `.gitignore`를 써 넣을 이유
 * 자체가 사라진다.
 *
 * 토큰을 레포 안에 두지 않는 이유는 특히 분명하다 — 자동 gitignore 는 완화책이지
 * 방지책이 아니다. `git add -f`, 전역 gitignore 충돌, 모노레포·서브모듈의 ignore 규칙
 * 차이 어디서든 샌다.
 *
 * ## 구조
 *
 * ```
 * ~/.agent-factory/
 *   config.json     apiBase · token       (사용자가 만든다. chmod 600 권장)
 *   cursors.json    세션별 워터마크
 *   queue.jsonl     미처리 델타 (항목마다 git_root 를 지닌다)
 *   processed.jsonl 처리 완료 로그
 *   state.json      업로드 완료 해시
 *   sessions/<projectSlug>/  세션 요약 .md + metrics.json (프로젝트별 하위 디렉터리)
 * ```
 *
 * `AGENT_FACTORY_HOME` 으로 위치를 바꿀 수 있다(테스트·격리용).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

/** 홈 디렉터리 경로. `~/.claude` 가 아닌 이유: 호스트 설정 디렉터리를 오염시키지 않고, Claude Code 자체 구조 변경에 종속되지 않기 위해서다. */
export function factoryHome() {
  return process.env.AGENT_FACTORY_HOME || path.join(os.homedir(), ".agent-factory");
}

export function homePath(...segments) {
  return path.join(factoryHome(), ...segments);
}

/** 홈을 만든다. 실패해도 던지지 않는다(훅은 흐름을 막지 않는다). */
export function ensureHome() {
  try {
    fs.mkdirSync(factoryHome(), { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(file, data) {
  try {
    ensureHome();
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

export const CONFIG_PATH = () => homePath("config.json");
export const CURSORS_PATH = () => homePath("cursors.json");
export const QUEUE_PATH = () => homePath("queue.jsonl");
export const PROCESSED_PATH = () => homePath("processed.jsonl");
export const STATE_PATH = () => homePath("state.json");

/** 모든 프로젝트 세션 기록(.md·metrics.json)의 사용자 레벨 루트. */
export const SESSIONS_DIR = () => homePath("sessions");

/**
 * 레포를 식별하는 결정론적 슬러그. 세션 기록이 레포 밖(사용자 레벨)에 모이면서
 * 서로 다른 레포의 같은 sha7 이 충돌할 수 있으므로, 프로젝트별 하위 디렉터리로 가른다.
 * 절대경로 해시를 붙여 basename 이 같은 다른 레포끼리도 갈린다(같은 머신에서 결정론적).
 */
export function projectSlug(projectPath) {
  const base = path.basename(projectPath.replace(/[\\/]+$/, "")) || "repo";
  const hash = crypto.createHash("sha256").update(projectPath).digest("hex").slice(0, 8);
  return `${base}-${hash}`;
}

/** 이 프로젝트의 세션 기록·계량치가 모이는 하위 디렉터리. */
export function projectSessionsDir(projectPath) {
  return homePath("sessions", projectSlug(projectPath));
}

/**
 * 업로드 설정을 읽는다. 환경변수가 config.json 을 이긴다(CI·일회성 override 용).
 *
 * 다만 환경변수만으로는 부족하다 — GUI 로 뜬 Claude Code 는 셸 프로필을 상속받지
 * 못할 수 있어 `.zshrc` 에 넣은 값이 터미널에선 되고 앱에선 조용히 무동작한다.
 * 그래서 config.json 이 기본 경로다.
 */
export function loadConfig() {
  const file = readJson(CONFIG_PATH(), {}) || {};
  return {
    apiBase: process.env.OBSERVER_API_BASE || file.apiBase || null,
    token: process.env.OBSERVER_TOKEN || file.token || null,
  };
}

/** 업로드 상태 키 — 같은 파일명이 레포마다 있을 수 있어 레포 경로로 네임스페이스를 나눈다. */
export function stateKey(projectPath, fileName) {
  return `${projectPath}::${fileName}`;
}
