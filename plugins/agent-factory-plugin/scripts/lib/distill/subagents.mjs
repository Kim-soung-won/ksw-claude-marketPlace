/**
 * 서브에이전트 귀속 — 세션 subagents/agent-<id>.jsonl 사이드카를 읽어 델타에 귀속한다.
 * 계층: constants/compact/factory-home ← subagents.
 */
import fs from "node:fs";
import path from "node:path";
import { appendLog, readJson } from "../../../lib/factory-home.mjs";
import { addUsage } from "./compact.mjs";

/**
 * 세션의 서브에이전트 사이드카 디렉터리를 유도한다. Claude Code 는 서브에이전트 턴을
 * 메인 트랜스크립트가 아니라 `<...>/<sessionId>/subagents/agent-<id>.jsonl` 형제
 * 디렉터리에 별도로 남긴다. jsonl_path 가 `.../<sessionId>.jsonl` 이므로 그 basename
 * (확장자 제거)이 곧 sessionId 디렉터리다. 없거나 접근 실패면 null(→ graceful).
 */
export function resolveSubagentsDir(meta) {
  try {
    const jp = meta && meta.jsonl_path;
    if (typeof jp !== "string") return null;
    const dir = path.join(path.dirname(jp), path.basename(jp, ".jsonl"), "subagents");
    return fs.existsSync(dir) ? dir : null;
  } catch {
    return null;
  }
}

/**
 * 서브에이전트 파일(agent-<id>.jsonl) 하나를 읽어 계량치를 집계한다. 메인 세션과 같은
 * 규칙(addUsage)으로 토큰을, tool_use 개수로 도구호출을, tool_result.is_error 개수로
 * 에러를 센다. 첫 이벤트 timestamp 는 toolUseId 폴백용. 읽기 실패면 로그 후 null.
 */
export function readSubagentUsage(agentJsonlPath) {
  let lines;
  try {
    lines = fs.readFileSync(agentJsonlPath, "utf8").split("\n");
  } catch (err) {
    appendLog("distill", `서브에이전트 파일 읽기 실패 (${path.basename(agentJsonlPath)}): ${err}`);
    return null;
  }
  const m = { input: 0, output: 0, cache_read: 0, cache_creation: 0, tool_calls: 0, errors: 0 };
  let firstTs = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let ev;
    try {
      ev = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (firstTs === null && typeof ev.timestamp === "string") firstTs = ev.timestamp;
    const msg = ev.message;
    if (ev.type === "assistant" && msg) {
      addUsage(m, msg.usage);
      for (const item of msg.content || []) {
        if (item.type === "tool_use") m.tool_calls += 1;
      }
    } else if (ev.type === "user" && msg && Array.isArray(msg.content)) {
      for (const item of msg.content) {
        if (item.type === "tool_result" && item.is_error) m.errors += 1;
      }
    }
  }
  return { ...m, first_ts: firstTs };
}

/**
 * 이 델타 구간에서 spawn 된 서브에이전트의 계량치를 사이드카에서 읽어 귀속한다.
 * 반환 `[{ agentType, metrics }]`. 귀속 판정은 **toolUseId 우선, 시각 폴백**:
 *   - meta.toolUseId 가 델타 내 Agent tool_use id 집합(toolUseIds)에 있으면 귀속 확정.
 *   - toolUseId 가 없거나 집합에 없을 때만, 짝 .jsonl 의 first_ts 가 델타 시각 범위
 *     [timeStart, timeEnd](둘 다 있을 때만) 안이면 귀속.
 * 경량 meta.json 만 전수 스캔해 매핑을 구하고, 대용량 .jsonl 은 귀속 확정 건만 읽는다
 * (무차별 폴더 읽기 금지 — 커밋 델타 정합성 유지). 실패 건은 로그 후 skip(throw 금지).
 */
export function attributeSubagents({ subagentsDir, toolUseIds, timeStart, timeEnd }) {
  if (!subagentsDir) return [];
  let metaFiles;
  try {
    metaFiles = fs.readdirSync(subagentsDir).filter((f) => f.endsWith(".meta.json"));
  } catch (err) {
    appendLog("distill", `subagents 디렉터리 읽기 실패: ${err}`);
    return [];
  }
  const out = [];
  for (const mf of metaFiles) {
    const meta = readJson(path.join(subagentsDir, mf), null);
    if (!meta || typeof meta.agentType !== "string") continue;
    const jsonlPath = path.join(subagentsDir, mf.replace(/\.meta\.json$/, ".jsonl"));

    let attributed = false;
    if (meta.toolUseId && toolUseIds.has(meta.toolUseId)) {
      attributed = true;
    } else {
      // 폴백: toolUseId 매칭 실패 시에만 첫 이벤트 시각으로 판정.
      const usage = readSubagentUsage(jsonlPath);
      if (usage && usage.first_ts && timeStart && timeEnd &&
          usage.first_ts >= timeStart && usage.first_ts <= timeEnd) {
        out.push({ agentType: meta.agentType, metrics: usage });
      }
      continue;
    }
    if (attributed) {
      const usage = readSubagentUsage(jsonlPath);
      if (usage) out.push({ agentType: meta.agentType, metrics: usage });
    }
  }
  return out;
}
