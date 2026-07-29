/**
 * 대용량 사용자 입력(프롬프트·붙여넣기)을 급상승 원인으로 잡는지 검증(zero-dep, node:test).
 * distillLines 통합 테스트 — 내용은 싣지 않고 길이·라벨만 남기는지 확인한다.
 * 실행: node --test scripts/lib/distill/hygiene.userinput.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { distillLines } from "./core.mjs";
import { USER_INPUT_SPIKE_MIN } from "./constants.mjs";

const big = "x".repeat(USER_INPUT_SPIKE_MIN + 100);
const small = "짧은 지시";

test("문자열 프롬프트가 문턱을 넘으면 user_input 스파이크로 잡고 내용은 싣지 않는다", () => {
  const lines = [
    JSON.stringify({ type: "user", message: { content: big } }),
    JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1000, cache_read_input_tokens: 5000 } },
    }),
  ];
  const spikes = distillLines(lines, {}).hygiene_delta.tool_result_spikes;
  const u = spikes.find((s) => s.tool === "user_input");
  assert.ok(u, "user_input 스파이크가 있어야 한다");
  assert.equal(u.len, big.length);
  assert.equal(u.turn, 1); // 유입은 다음 assistant 턴(=1)에 반영
  assert.equal(u.target, undefined); // 내용(대상) 미포함 — 길이만
  // 스파이크 어디에도 원문 문자열이 실리지 않는다.
  assert.equal(JSON.stringify(spikes).includes(big), false);
});

test("문턱 미만 프롬프트는 잡지 않는다", () => {
  const lines = [JSON.stringify({ type: "user", message: { content: small } })];
  const spikes = distillLines(lines, {}).hygiene_delta.tool_result_spikes;
  assert.equal(spikes.some((s) => s.tool === "user_input"), false);
});

test("배열 프롬프트의 text 블록 총량도 합산해 잡는다", () => {
  const half = "y".repeat(Math.ceil(USER_INPUT_SPIKE_MIN / 2) + 50);
  const lines = [
    JSON.stringify({
      type: "user",
      message: { content: [{ type: "text", text: half }, { type: "text", text: half }] },
    }),
  ];
  const spikes = distillLines(lines, {}).hygiene_delta.tool_result_spikes;
  const u = spikes.find((s) => s.tool === "user_input");
  assert.ok(u, "text 블록 총량이 문턱을 넘으면 잡아야 한다");
  assert.equal(u.len, half.length * 2);
});
