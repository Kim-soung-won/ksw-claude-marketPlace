/**
 * 세션 위생(컨텍스트 경계) 지표 — 결정론적 계산(LLM 없음).
 *
 * 두 스코프로 나뉜다:
 *   - 델타 스코프(computeDeltaHygiene): 이 커밋 델타 안에서만 계산. cr:gen 비율, tool_result
 *     출력 급증, 턴별 컨텍스트 급증. distillLines 의 기존 단일 순회에서 모은 값을 받는다.
 *   - 세션 누적 스코프(recordSessionSample): 커밋마다 컨텍스트 크기 샘플 1개를
 *     session-hygiene.json 에 증분 적재해, 세션 전체를 다시 읽지 않고도 커밋들에 걸친
 *     컨텍스트 기울기(context_slope)와 리셋 횟수(session_resets)를 복원한다.
 *
 * 왜 세션 누적이 필요한가: 한 세션에서 여러 번 커밋하면 각 델타는 멀쩡해 보여도, 세션
 * 전체로는 컨텍스트가 단조 누적되고 compact/clear 없이 부풀 수 있다(안티패턴). 그 신호는
 * 델타 하나로는 잡히지 않으므로 커밋 간 샘플의 기울기로만 드러난다.
 *
 * 계층: constants/factory-home ← hygiene ← core.
 */
import {
  HYGIENE_PATH,
  appendLog,
  readJson,
  writeJson,
} from "../../../lib/factory-home.mjs";
import {
  MAX_CONTEXT_SERIES,
  MAX_HYGIENE_SAMPLES,
  MAX_HYGIENE_SESSIONS,
  MAX_RESULT_SPIKES,
} from "./constants.mjs";

// 글자→토큰 대략 환산(영문·코드 기준 경험값). 재청구 비용 추정용 근사다.
const CHARS_PER_TOKEN = 4;

/**
 * 스파이크 후보를 "재청구 추정 비용" 기준으로 마감한다(순수·결정론).
 *
 * 한 tool_result 는 생성된 턴 이후 델타가 끝날 때까지 컨텍스트에 남아 매 assistant
 * 턴마다 cache_read 로 재청구된다. 그 총량을 (글자→토큰) × 잔류 턴으로 추정한다.
 *
 * 근사 한계: (1) 글자÷4 토큰 환산은 정밀치가 아니다. (2) 델타 내부에서 compact/clear 가
 * 일어나면 그 이전 결과는 실제로는 이후 재청구되지 않지만, core 단일 순회는 델타 단위
 * boolean(delta_shrank)만 알고 compact 지점의 턴 인덱스를 몰라 "중간 compact 무시"로
 * 근사한다. 정밀 계산은 후속 과제.
 *
 * @param {Array<{len:number, turn_index:number, turn?:number, tool?:string, target?:string}>} candidates
 *   결과 크기와 생성 시점 턴 인덱스, (있으면) 급상승 턴·원인 도구·대상.
 * @param {number} totalAssistantTurns 델타 내 총 assistant 턴 수
 * @returns {Array<{len:number, turns_resident:number, rebilled_tokens:number, turn?:number, tool?:string, target?:string}>}
 *   재청구 추정 토큰 내림차순 상위 MAX_RESULT_SPIKES 개. turn/tool/target 은 원인 라벨(있을 때만).
 */
export function finalizeResultSpikes(candidates, totalAssistantTurns) {
  const total = typeof totalAssistantTurns === "number" ? totalAssistantTurns : 0;
  const scored = (candidates || []).map((c) => {
    const turnsResident = Math.max(0, total - c.turn_index);
    const rebilledTokens = Math.round((c.len / CHARS_PER_TOKEN) * turnsResident);
    const out = { len: c.len, turns_resident: turnsResident, rebilled_tokens: rebilledTokens };
    // 원인 라벨은 있을 때만 싣는다(구버전·미매칭 후보와 하위호환).
    if (typeof c.turn === "number") out.turn = c.turn;
    if (c.tool) out.tool = c.tool;
    if (c.target) out.target = c.target;
    return out;
  });
  // 재청구 추정 비용 내림차순. 동률이면 일회성 크기(len) 큰 것을 앞에 둔다.
  scored.sort((a, b) => b.rebilled_tokens - a.rebilled_tokens || b.len - a.len);
  return scored.slice(0, MAX_RESULT_SPIKES);
}

/**
 * 턴별 컨텍스트 시계열을 방어적 상한 안에서 마감한다(순수·결정론).
 *
 * 다운샘플하지 않고 전량 보존한다 — "컨텍스트가 언제 부풀었는가"(초과 비용 시점)를
 * 그대로 드러내는 것이 목적이라 형태를 뭉개지 않는다. 다만 폭주 세션이 한 커밋에 통째로
 * 잡히는 극단만 유계화한다: 상한 초과 시 초반 턴부터 유지해 누적 스토리(램프)를 지킨다.
 *
 * @param {Array<[number, number]>} series `[turnIndex, ctx]` 쌍(생성 순서).
 * @returns {Array<[number, number]>} 상한 이내로 자른 시계열.
 */
export function finalizeContextSeries(series) {
  const s = Array.isArray(series) ? series : [];
  return s.length > MAX_CONTEXT_SERIES ? s.slice(0, MAX_CONTEXT_SERIES) : s;
}

/**
 * 델타 스코프 위생 지표를 평탄 객체로 만든다(결정론적).
 * distillLines 가 한 번의 순회에서 모은 원시값을 그대로 받는다.
 *
 * @param {object} p
 * @param {{cache_read:number, cache_creation:number}} p.totals 델타 전체 토큰 합계
 * @param {number} p.maxResultLen  델타 내 최대 tool_result 길이(출력 급증)
 * @param {Array<{len:number, turn_index:number}>} p.resultSpikeCandidates
 *   임계 초과 tool_result 후보(생성 시점 턴 인덱스 포함). finalizeResultSpikes 로 마감한다.
 * @param {number} p.totalAssistantTurns  델타 내 총 assistant 턴 수(잔류 턴 계산 기준·API 호출 수)
 * @param {number} p.maxTurnContext  델타 내 최대 턴 컨텍스트(input+cache_read)
 * @param {number} p.maxTurnContextJump  인접 턴 컨텍스트 최대 증가폭(단일 턴 급증)
 * @param {Array<[number, number]>} p.contextSeries  턴별 컨텍스트 시계열 `[turnIndex, ctx]`
 * @returns {object} 사이드카에 실을 델타 스코프 위생 지표
 */
export function computeDeltaHygiene({
  totals,
  maxResultLen,
  resultSpikeCandidates,
  totalAssistantTurns,
  maxTurnContext,
  maxTurnContextJump,
  contextSeries,
}) {
  // cache_creation 이 0 이면 비율이 정의되지 않는다(0 나눗셈) → null 로 명시한다.
  const crGenRatio =
    totals && totals.cache_creation > 0 ? totals.cache_read / totals.cache_creation : null;
  return {
    cache_read: totals ? totals.cache_read : 0,
    cache_creation: totals ? totals.cache_creation : 0,
    cr_gen_ratio: crGenRatio,
    max_tool_result_len: maxResultLen || 0,
    tool_result_spikes: finalizeResultSpikes(resultSpikeCandidates, totalAssistantTurns),
    max_turn_context: maxTurnContext || 0,
    max_turn_context_jump: maxTurnContextJump || 0,
    // 턴별 컨텍스트 시계열(전량) + 총 assistant 턴 수. "avg ctx × calls" 공식과 스파크라인의 입력.
    context_series: finalizeContextSeries(contextSeries),
    assistant_turns: typeof totalAssistantTurns === "number" ? totalAssistantTurns : 0,
  };
}

/**
 * 유지된 샘플의 context_size 로 커밋당 컨텍스트 증가량(기울기)을 최소자승 회귀로 구한다.
 * x 는 샘플 인덱스(0..n-1), y 는 context_size. 숫자 샘플이 2개 미만이면 null.
 */
function computeSlope(samples) {
  const ys = samples
    .map((s) => s.context_size)
    .filter((v) => typeof v === "number");
  const n = ys.length;
  if (n < 2) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += ys[i];
    sumXY += i * ys[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * 세션 누적 스코프 — 커밋당 컨텍스트 크기 샘플 1개를 session-hygiene.json 에 증분 적재하고
 * 세션의 기울기·리셋 횟수를 반환한다. 세션 전체 JSONL 을 다시 읽지 않는다.
 *
 * 멱등성: 같은 (sessionId, commit) 샘플이 이미 있으면(amend·재-distill) 재적재·재계상하지
 * 않는다. 리셋 카운터는 새 shrank 샘플을 처음 추가할 때만 +1 하며, 샘플 프루닝과 무관하게
 * monotonic 으로 보존된다.
 *
 * @param {object} p
 * @param {string|null} p.sessionId  세션 식별자(없으면 no-op)
 * @param {string|null} p.commit     커밋 sha(없으면 no-op)
 * @param {string|null} p.capturedAt 커밋 캡처 시각(ISO)
 * @param {number|null} p.contextSize 이 커밋 시점 컨텍스트 크기(델타 마지막 assistant 턴)
 * @param {boolean} p.shrank         이 커밋 델타에서 파일 축소(compact/clear)가 있었는지
 * @returns {{session_resets:number, context_slope:number|null, context_samples:number}|null}
 *   저장 실패나 신원 부재 시 null.
 */
export function recordSessionSample({ sessionId, commit, capturedAt, contextSize, shrank }) {
  // 단일 구간 디버그 모드(신원 없음)에서는 세션 저장을 하지 않는다.
  if (!sessionId || !commit) return null;

  const store = readJson(HYGIENE_PATH(), {}) || {};
  let sess = store[sessionId];
  if (!sess || typeof sess !== "object") {
    sess = { samples: [], resets: 0 };
  }
  if (!Array.isArray(sess.samples)) sess.samples = [];
  if (typeof sess.resets !== "number") sess.resets = 0;

  // 멱등: 같은 커밋이 이미 있으면 재적재·재계상하지 않는다(이중 계상 차단).
  const already = sess.samples.some((s) => s.commit === commit);
  if (!already) {
    sess.samples.push({
      commit,
      captured_at: capturedAt || null,
      context_size: typeof contextSize === "number" ? contextSize : null,
      shrank: shrank === true,
    });
    // 새 shrank 샘플을 처음 추가할 때만 누적 리셋 카운터를 올린다.
    if (shrank === true) sess.resets += 1;
  }

  // 샘플 프루닝 — 최신 우선 유지. resets 는 별도라 프루닝의 영향을 받지 않는다.
  if (sess.samples.length > MAX_HYGIENE_SAMPLES) {
    sess.samples = sess.samples.slice(sess.samples.length - MAX_HYGIENE_SAMPLES);
  }

  sess.updated_at = capturedAt || sess.updated_at || null;
  store[sessionId] = sess;

  // 세션 수 프루닝 — updated_at 오름차순으로 오래된 세션부터 버린다. updated_at 없는
  // 항목은 가장 오래된 것으로 취급한다(현재 세션은 방금 갱신돼 최신이라 살아남는다).
  const keys = Object.keys(store);
  if (keys.length > MAX_HYGIENE_SESSIONS) {
    keys
      .sort((a, b) => ((store[a].updated_at || "") < (store[b].updated_at || "") ? -1 : 1))
      .slice(0, keys.length - MAX_HYGIENE_SESSIONS)
      .forEach((k) => delete store[k]);
  }

  const contextSlope = computeSlope(sess.samples);

  // 저장 실패는 삼키고 null 반환 — distill 흐름을 막지 않는다(사이드카는 델타 스코프만
  // 담아 그대로 나간다). 반환값이 null 이면 core 가 세션 스코프 필드를 null 병합한다.
  if (!writeJson(HYGIENE_PATH(), store)) {
    appendLog("distill", `session-hygiene 저장 실패 (session=${sessionId})`);
    return null;
  }

  return {
    session_resets: sess.resets,
    context_slope: contextSlope,
    context_samples: sess.samples.length,
  };
}
