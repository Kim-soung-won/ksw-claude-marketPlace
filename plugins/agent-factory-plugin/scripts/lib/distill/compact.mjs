/**
 * distill 압축 유틸 — 텍스트 절단·마커 감지·슬라이스 읽기·tool_use 압축·토큰 누산·
 * timeline 유계화. constants 외 의존 없음(계층: constants ← compact).
 */
import fs from "node:fs";
import { TEXT_LIMIT, CMD_LIMIT, TIMELINE_LIMIT } from "./constants.mjs";

/** 텍스트에서 어휘 사전과 일치하는 마커를 모은다. */
export function matchMarkers(text, lexicon) {
  if (typeof text !== "string") return [];
  return lexicon.filter((m) => text.includes(m));
}

export function truncate(s, n) {
  if (typeof s !== "string") return s;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + `…(+${t.length - n})` : t;
}

export function readSlice(jsonlPath, fromOffset, toOffset) {
  const fd = fs.openSync(jsonlPath, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, Math.min(fromOffset || 0, size));
    const end = Math.max(start, Math.min(toOffset ?? size, size));
    const len = end - start;
    if (len <= 0) return [];
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    return buf.toString("utf8").split("\n");
  } finally {
    fs.closeSync(fd);
  }
}

/** tool_use input을 도구별로 한 줄 신호로 압축한다. */
export function compactToolInput(name, input) {
  if (!input || typeof input !== "object") return undefined;
  const base = (p) => (typeof p === "string" ? p.split("/").pop() : p);
  switch (name) {
    case "Edit":
    case "Write":
    case "Read":
    case "NotebookEdit":
      return base(input.file_path);
    case "Bash":
      return truncate(input.command, CMD_LIMIT);
    case "Agent":
      return truncate(
        `${input.subagent_type || "general"}: ${input.description || ""}`,
        TEXT_LIMIT,
      );
    case "Skill":
      return input.args ? `${input.skill} (${truncate(input.args, 80)})` : input.skill;
    case "Task":
    case "Artifact":
      return base(input.file_path) || truncate(input.description, 120);
    default:
      if (name && name.startsWith("mcp__")) {
        const parts = name.split("__");
        return parts.length >= 3 ? `${parts[1]}/${parts.slice(2).join("__")}` : name;
      }
      return undefined;
  }
}

export function addUsage(totals, usage) {
  if (!usage) return;
  totals.input += usage.input_tokens || 0;
  totals.output += usage.output_tokens || 0;
  totals.cache_read += usage.cache_read_input_tokens || 0;
  totals.cache_creation += usage.cache_creation_input_tokens || 0;
}

/**
 * timeline 을 결정론적으로 유계화한다(LLM 없이 배열 순회만). 반환 `{ timeline, meta }`.
 *
 * 신호 보존 우선순위:
 *   P0 = 절대 보존 — user/assistant 텍스트(감정 flag 포함)·에러 항목
 *   P1 = 압축/축소 대상 — tool_use (반복은 접고, 넘치면 버린다)
 *   P2 = 최우선 폐기 — 성공 stdout 길이 항목
 *
 * 패스 A) 연속 실행 접기: 인접 tool_use 가 tool·by 모두 같으면 하나로 접어 repeat:n 을
 *         단다(text/error/stdout 이 사이에 오면 run 이 끊긴다). 'Read/Edit 버스트'를
 *         O(1) 로 보존하고 에이전트 경계(by)를 유지한다.
 * 패스 B) 여전히 초과면 P2(stdout)를 등장 순서로 폐기.
 * 패스 C) 그래도 초과면 P0 를 전부 보존한 채 남은 P1 을 budget(limit - P0수)까지만 채운다.
 *         P0 만으로 limit 를 넘으면 P0 는 전부 남긴다(soft cap — 핵심 신호는 손실 금지).
 */
export function boundTimeline(timeline) {
  const total = timeline.length;
  const meta = {
    limit: TIMELINE_LIMIT,
    total_original: total,
    collapsed_runs: 0,
    collapsed_items: 0,
    dropped_stdout: 0,
    dropped_tools: 0,
  };

  const isP0 = (it) => it.role === "user" || it.role === "assistant" || it.error === true;
  const isStdout = (it) => typeof it.result_len === "number";
  const isTool = (it) => typeof it.tool === "string";

  // 패스 A — 인접 동일 tool_use 접기
  const collapsed = [];
  for (const it of timeline) {
    const prev = collapsed[collapsed.length - 1];
    if (
      isTool(it) &&
      prev &&
      isTool(prev) &&
      prev.tool === it.tool &&
      prev.by === it.by
    ) {
      prev.repeat = (prev.repeat || 1) + 1;
      meta.collapsed_items += 1;
      if (prev.repeat === 2) meta.collapsed_runs += 1;
      continue;
    }
    collapsed.push(isTool(it) ? { ...it } : it);
  }

  if (collapsed.length <= TIMELINE_LIMIT) {
    return { timeline: collapsed, meta };
  }

  // 패스 B — 성공 stdout 항목 폐기
  let afterB = collapsed;
  const stdoutCount = collapsed.filter(isStdout).length;
  if (stdoutCount > 0) {
    afterB = collapsed.filter((it) => {
      if (isStdout(it)) {
        meta.dropped_stdout += 1;
        return false;
      }
      return true;
    });
  }

  if (afterB.length <= TIMELINE_LIMIT) {
    return { timeline: afterB, meta };
  }

  // 패스 C — P0 전량 보존 + P1 을 budget 까지만
  const p0 = afterB.filter(isP0);
  const budget = Math.max(TIMELINE_LIMIT - p0.length, 0);
  const result = [];
  let kept = 0;
  for (const it of afterB) {
    if (isP0(it)) {
      result.push(it);
    } else if (kept < budget) {
      result.push(it);
      kept += 1;
    } else {
      meta.dropped_tools += 1;
    }
  }
  return { timeline: result, meta };
}

/** attributionAgent 별 계량 누산기를 가져오거나 만든다(에이전트별 토큰·호출·에러). */
export function bumpAgent(map, key) {
  let m = map.get(key);
  if (!m) {
    m = {
      agent: key,
      input: 0,
      output: 0,
      cache_read: 0,
      cache_creation: 0,
      tool_calls: 0,
      errors: 0,
    };
    map.set(key, m);
  }
  return m;
}
