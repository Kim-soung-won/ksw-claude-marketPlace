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
import { MAX_HYGIENE_SAMPLES, MAX_HYGIENE_SESSIONS } from "./constants.mjs";

/**
 * 델타 스코프 위생 지표를 평탄 객체로 만든다(결정론적).
 * distillLines 가 한 번의 순회에서 모은 원시값을 그대로 받는다.
 *
 * @param {object} p
 * @param {{cache_read:number, cache_creation:number}} p.totals 델타 전체 토큰 합계
 * @param {number} p.maxResultLen  델타 내 최대 tool_result 길이(출력 급증)
 * @param {Array<{len:number}>} p.resultSpikes  임계 초과 result_len 목록(상한까지)
 * @param {number} p.maxTurnContext  델타 내 최대 턴 컨텍스트(input+cache_read)
 * @param {number} p.maxTurnContextJump  인접 턴 컨텍스트 최대 증가폭(단일 턴 급증)
 * @returns {object} 사이드카에 실을 델타 스코프 위생 지표
 */
export function computeDeltaHygiene({
  totals,
  maxResultLen,
  resultSpikes,
  maxTurnContext,
  maxTurnContextJump,
}) {
  // cache_creation 이 0 이면 비율이 정의되지 않는다(0 나눗셈) → null 로 명시한다.
  const crGenRatio =
    totals && totals.cache_creation > 0 ? totals.cache_read / totals.cache_creation : null;
  return {
    cache_read: totals ? totals.cache_read : 0,
    cache_creation: totals ? totals.cache_creation : 0,
    cr_gen_ratio: crGenRatio,
    max_tool_result_len: maxResultLen || 0,
    tool_result_spikes: resultSpikes || [],
    max_turn_context: maxTurnContext || 0,
    max_turn_context_jump: maxTurnContextJump || 0,
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
