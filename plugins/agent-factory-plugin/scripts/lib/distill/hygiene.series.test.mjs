/**
 * finalizeContextSeries 전량 보존·방어 상한 로직 단위 테스트(zero-dep, node:test).
 * 실행: node --test scripts/lib/distill/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { finalizeContextSeries } from "./hygiene.mjs";
import { MAX_CONTEXT_SERIES } from "./constants.mjs";

test("상한 이내면 다운샘플 없이 전량 그대로 보존한다", () => {
  const series = [
    [1, 1000],
    [2, 5000],
    [3, 3000],
  ];
  assert.deepEqual(finalizeContextSeries(series), series);
});

test("빈·비배열 입력은 빈 배열로 방어한다", () => {
  assert.deepEqual(finalizeContextSeries([]), []);
  assert.deepEqual(finalizeContextSeries(undefined), []);
  assert.deepEqual(finalizeContextSeries(null), []);
});

test("상한 초과 시 초반 턴부터 유지해 누적 램프를 지킨다", () => {
  const big = Array.from({ length: MAX_CONTEXT_SERIES + 50 }, (_, i) => [i + 1, i * 10]);
  const out = finalizeContextSeries(big);
  assert.equal(out.length, MAX_CONTEXT_SERIES);
  assert.deepEqual(out[0], [1, 0]); // 초반 보존
  assert.deepEqual(out[out.length - 1], [MAX_CONTEXT_SERIES, (MAX_CONTEXT_SERIES - 1) * 10]);
});
