/**
 * finalizeResultSpikes 뺄셈·정렬 로직 단위 테스트(zero-dep, node:test).
 * 실행: node --test scripts/lib/distill/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { finalizeResultSpikes } from "./hygiene.mjs";

test("잔류 턴 = 총 턴 - 생성 시점 턴, 재청구 = 글자÷4 × 잔류 턴", () => {
  const [s] = finalizeResultSpikes([{ len: 8000, turn_index: 2 }], 52);
  assert.equal(s.turns_resident, 50);
  assert.equal(s.rebilled_tokens, Math.round((8000 / 4) * 50)); // 100000
  assert.equal(s.len, 8000);
});

test("세션 말미 생성(turn_index == 총 턴)은 잔류 0·재청구 0 — 초반 큰 파일과 구분된다", () => {
  const [s] = finalizeResultSpikes([{ len: 12000, turn_index: 40 }], 40);
  assert.equal(s.turns_resident, 0);
  assert.equal(s.rebilled_tokens, 0);
});

test("정렬은 len 이 아니라 재청구 비용(rebilled_tokens) 내림차순", () => {
  // 작지만 오래 잔류한 결과가, 크지만 말미에 생긴 결과보다 상위여야 한다.
  const small_long = { len: 3000, turn_index: 1 }; // 잔류 49 → 36750
  const big_late = { len: 20000, turn_index: 49 }; // 잔류 1 → 5000
  const [first, second] = finalizeResultSpikes([big_late, small_long], 50);
  assert.equal(first.len, 3000);
  assert.equal(second.len, 20000);
  assert.ok(first.rebilled_tokens > second.rebilled_tokens);
});

test("상한(MAX_RESULT_SPIKES=10)으로 상위 N개만 남긴다", () => {
  const candidates = Array.from({ length: 25 }, (_, i) => ({
    len: 2000 + i * 100,
    turn_index: 0,
  }));
  const out = finalizeResultSpikes(candidates, 30);
  assert.equal(out.length, 10);
  // 가장 큰(=재청구 최대) 후보가 첫 항목
  assert.equal(out[0].len, 2000 + 24 * 100);
});

test("빈 입력·총 턴 0 에도 안전하다", () => {
  assert.deepEqual(finalizeResultSpikes([], 10), []);
  assert.deepEqual(finalizeResultSpikes(undefined, 0), []);
  const [s] = finalizeResultSpikes([{ len: 5000, turn_index: 0 }], 0);
  assert.equal(s.turns_resident, 0);
  assert.equal(s.rebilled_tokens, 0);
});
