import { test } from "node:test";
import assert from "node:assert/strict";
import { exactPermutationTest, binomial } from "../src/permutation.js";

test("各一条观测：2 种分配 D 均为 1，p=1", () => {
  const p = exactPermutationTest([1], [2]);
  assert.equal(p.totalAssignments, 2n);
  assert.equal(p.binomial, 2n);
  assert.equal(p.tailCount, 2n);
  assert.equal(p.pValue.reducedNumerator, 1n);
  assert.equal(p.pValue.reducedDenominator, 1n);
});

test("全相等：所有分配 D=0，p=1", () => {
  const p = exactPermutationTest([5, 5], [5]);
  assert.equal(p.totalAssignments, 3n);
  assert.equal(p.tailCount, 3n);
  assert.equal(p.pValue.decimal, 1);
});

test("完全分离 [1,2] vs [3,4]：手算分布 {1:2, 1/2:4}，p=1/3", () => {
  const p = exactPermutationTest([1, 2], [3, 4]);
  assert.equal(p.totalAssignments, 6n);
  assert.equal(p.observedNumerator, 4n);
  assert.equal(p.tailCount, 2n);
  assert.equal(p.pValue.reducedNumerator, 1n);
  assert.equal(p.pValue.reducedDenominator, 3n);
  const dist = new Map(p.distribution.map((d) => [d.numerator.toString(), d.count]));
  assert.equal(dist.get("4"), 2n);
  assert.equal(dist.get("2"), 4n);
});

test("不同样本量 [1] vs [2,3]：p=2/3", () => {
  const p = exactPermutationTest([1], [2, 3]);
  assert.equal(p.totalAssignments, 3n);
  assert.equal(p.tailCount, 2n);
  assert.equal(p.pValue.reducedNumerator, 2n);
  assert.equal(p.pValue.reducedDenominator, 3n);
});

test("并列值案例的计数分布总和等于组合数，概率和为 1", () => {
  const p = exactPermutationTest([0, 0, 5, 5], [0, 5, 5, 5]);
  assert.equal(p.totalAssignments, binomial(8, 4));
  let sum = 0n;
  let prob = 0;
  for (const d of p.distribution) {
    sum += d.count;
    prob += Number(d.count) / Number(p.totalAssignments);
  }
  assert.equal(sum, p.totalAssignments);
  assert.ok(Math.abs(prob - 1) < 1e-12);
  assert.ok(p.pValue.decimal > 0 && p.pValue.decimal <= 1);
});

test("交换两组：D 与双侧 p 值不变", () => {
  const p1 = exactPermutationTest([1, 2], [3, 4, 5]);
  const p2 = exactPermutationTest([3, 4, 5], [1, 2]);
  assert.equal(p1.observedD, p2.observedD);
  assert.equal(p1.tailCount, p2.tailCount);
  assert.equal(p1.pValue.decimal, p2.pValue.decimal);
});

test("样本内重排不改变检验结果", () => {
  const p1 = exactPermutationTest([3, 1, 2], [5, 4]);
  const p2 = exactPermutationTest([1, 2, 3], [4, 5]);
  assert.equal(p1.observedNumerator, p2.observedNumerator);
  assert.equal(p1.tailCount, p2.tailCount);
});

test("p 值范围：任意小样本均有 0 < p <= 1", () => {
  for (const [a, b] of [
    [[1], [1]],
    [[1, 1], [2, 2]],
    [[-5, 0, 5], [0, 0]],
  ] as [number[], number[]][]) {
    const p = exactPermutationTest(a, b);
    assert.ok(p.pValue.decimal > 0 && p.pValue.decimal <= 1);
    assert.ok(p.tailCount >= 1n); // 至少包含观测自身
  }
});
