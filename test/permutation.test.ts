import { test } from "node:test";
import assert from "node:assert/strict";
import { exactPermutationTest, binomial } from "../src/permutation";

test("各一条观测：p=1", () => {
  const r = exactPermutationTest([1], [2]);
  assert.equal(r.totalAssignments, 2);
  assert.equal(r.tailCount, 2);
  assert.equal(r.pValue.reducedNumerator, 1);
  assert.equal(r.pValue.reducedDenominator, 1);
  assert.ok(r.distributionSumOk);
});

test("完全分离 2v2：手算尾部计数 2/6 = 1/3", () => {
  // 手算：C(4,2)=6 种分配中，仅 {1,2}|{3,4} 与 {3,4}|{1,2} 达到 D=1
  const r = exactPermutationTest([1, 2], [3, 4]);
  assert.equal(r.totalAssignments, 6);
  assert.equal(r.tailCount, 2);
  assert.equal(r.pValue.numerator, 2);
  assert.equal(r.pValue.denominator, 6);
  assert.equal(r.pValue.reducedNumerator, 1);
  assert.equal(r.pValue.reducedDenominator, 3);
  // 分布：Dnum=2 有 4 种，Dnum=4 有 2 种
  assert.deepEqual(
    r.distribution.map((d) => [d.dNumerator, d.count]),
    [
      [2, 4],
      [4, 2],
    ]
  );
});

test("完全相同：D=0，p=1，分布集中于 0", () => {
  const r = exactPermutationTest([5, 5], [5, 5]);
  assert.equal(r.observedDNumerator, 0);
  assert.equal(r.pValue.decimal, 1);
  assert.deepEqual(
    r.distribution.map((d) => [d.dNumerator, d.count]),
    [[0, 6]]
  );
});

test("含并列值 3v3：观测 D=3/9，总数 C(6,3)=20", () => {
  const r = exactPermutationTest([1, 1, 2], [1, 2, 2]);
  assert.equal(r.observedDNumerator, 3);
  assert.equal(r.totalAssignments, 20);
  assert.ok(r.distributionSumOk);
  assert.ok(r.pValue.decimal > 0 && r.pValue.decimal <= 1);
});

test("不同样本量 1v2：手算 p=2/3", () => {
  // 手算：C(3,1)=3，分母 n*m=2；A={1} 时 Dnum=2，A={2} 时 Dnum=1，A={3} 时 Dnum=2
  const r = exactPermutationTest([1], [2, 3]);
  assert.equal(r.totalAssignments, 3);
  assert.equal(r.tailCount, 2);
  assert.equal(r.pValue.reducedNumerator, 2);
  assert.equal(r.pValue.reducedDenominator, 3);
});

test("交换两组：D 与双侧 p 值不变", () => {
  const r1 = exactPermutationTest([1, 1, 2], [1, 2, 2]);
  const r2 = exactPermutationTest([1, 2, 2], [1, 1, 2]);
  assert.equal(r1.observedDNumerator, r2.observedDNumerator);
  assert.equal(r1.tailCount, r2.tailCount);
  assert.equal(r1.pValue.decimal, r2.pValue.decimal);
});

test("样本内重排：置换结果不变", () => {
  const r1 = exactPermutationTest([1, 1, 2], [1, 2, 2]);
  const r2 = exactPermutationTest([2, 1, 1], [2, 2, 1]);
  assert.equal(r1.tailCount, r2.tailCount);
  assert.equal(r1.totalAssignments, r2.totalAssignments);
});

test("独立校验：分布计数和等于组合数，概率和为 1，p 在 [0,1]", () => {
  const cases: [number[], number[]][] = [
    [[0, 0, 1], [0, 1, 1]],
    [[-3, 7], [7, 7, -3]],
    [[1, 2, 3, 4], [5, 6, 7, 8]],
    [[2, 2, 2, 2], [2]],
  ];
  for (const [a, b] of cases) {
    const r = exactPermutationTest(a, b);
    const expected = binomial(a.length + b.length, a.length);
    assert.equal(r.totalAssignments, expected);
    const sum = r.distribution.reduce((s, d) => s + d.count, 0);
    assert.equal(sum, expected);
    assert.ok(r.distributionSumOk);
    assert.ok(r.pValue.decimal >= 0 && r.pValue.decimal <= 1);
    assert.ok(r.tailCount >= 1); // 观测分配自身总在尾部内
  }
});

test("binomial 基本值", () => {
  assert.equal(binomial(16, 8), 12870);
  assert.equal(binomial(6, 3), 20);
  assert.equal(binomial(2, 1), 2);
});
