import { test } from "node:test";
import assert from "node:assert/strict";
import { ksDistance } from "../src/ks.js";

test("各一条观测：D=1", () => {
  const r = ksDistance([1], [2]);
  assert.equal(r.maxNumerator, 1n);
  assert.equal(r.D, 1);
  assert.equal(r.firstMaxValue, 1);
});

test("全相等：D=0", () => {
  const r = ksDistance([5, 5], [5]);
  assert.equal(r.maxNumerator, 0n);
  assert.equal(r.D, 0);
});

test("完全分离：D=1，首次达到位置为 A 组最大值", () => {
  const r = ksDistance([1, 2], [3, 4]);
  assert.equal(r.D, 1);
  assert.equal(r.firstMaxValue, 2);
});

test("并列值同步跃变：a=[0,0,5,5], b=[0,5,5,5] 的 D=1/4 而非 1/2", () => {
  const r = ksDistance([0, 0, 5, 5], [0, 5, 5, 5]);
  assert.equal(r.denominator, 16);
  assert.equal(r.maxNumerator, 4n);
  assert.equal(r.D, 0.25);
  // 若在 0 处先推进 A 组两条会得到虚假的 0.5；这里验证不会发生
  const row0 = r.table[0];
  assert.equal(row0.value, 0);
  assert.equal(row0.cumA, 2);
  assert.equal(row0.cumB, 1);
  assert.equal(row0.absDiff, 0.25);
});

test("负数观测：a=[-3,-1], b=[-2,0] 的 D=1/2", () => {
  const r = ksDistance([-3, -1], [-2, 0]);
  assert.equal(r.maxNumerator, 2n);
  assert.equal(r.D, 0.5);
  assert.equal(r.firstMaxValue, -3);
});

test("样本内重排不改变 D 与比较表", () => {
  const r1 = ksDistance([3, 1, 2], [5, 4]);
  const r2 = ksDistance([1, 2, 3], [4, 5]);
  assert.equal(r1.maxNumerator, r2.maxNumerator);
  assert.deepEqual(r1.table, r2.table);
});

test("交换两组：D 不变，有符号分子取反", () => {
  const r1 = ksDistance([1, 2], [3, 4, 5]);
  const r2 = ksDistance([3, 4, 5], [1, 2]);
  assert.equal(r1.maxNumerator, r2.maxNumerator);
  assert.equal(r1.D, r2.D);
  for (let i = 0; i < r1.table.length; i++) {
    assert.equal(r1.table[i].diffNumerator, -r2.table[i].diffNumerator);
  }
});

test("重复观测不去重", () => {
  const r = ksDistance([7, 7, 7], [7]);
  assert.equal(r.n, 3);
  assert.equal(r.m, 1);
  assert.equal(r.table.length, 1);
  assert.equal(r.table[0].countA, 3);
});
