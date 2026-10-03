import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSamples } from "../src/validate";
import { ApiError } from "../src/errors";

test("空组报错", () => {
  assert.throws(() => validateSamples([], [1]), (e: unknown) => {
    return e instanceof ApiError && e.code === "INVALID_INPUT";
  });
});

test("超过 16 条合并样本直接报错，不抽样", () => {
  const a = Array.from({ length: 9 }, (_, i) => i);
  const b = Array.from({ length: 8 }, (_, i) => i);
  assert.throws(() => validateSamples(a, b), (e: unknown) => {
    return e instanceof ApiError && e.code === "LIMIT_EXCEEDED";
  });
});

test("恰好 16 条允许", () => {
  const a = Array.from({ length: 8 }, (_, i) => i);
  const b = Array.from({ length: 8 }, (_, i) => i);
  assert.doesNotThrow(() => validateSamples(a, b));
});

test("非安全整数报错", () => {
  assert.throws(() => validateSamples([1.5], [2]), ApiError);
  assert.throws(() => validateSamples([Number.MAX_SAFE_INTEGER + 1], [2]), ApiError);
  assert.throws(() => validateSamples(["3"], [2]), ApiError);
});

test("负值与重复值允许且不去重", () => {
  const { a, b } = validateSamples([-5, -5, 3], [3, 3]);
  assert.deepEqual(a, [-5, -5, 3]);
  assert.deepEqual(b, [3, 3]);
});
