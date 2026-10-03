import { test } from "node:test";
import assert from "node:assert/strict";
import { ksDistance } from "../src/ks";

test("各一条观测：D=1", () => {
  const r = ksDistance([1], [2]);
  assert.equal(r.dNumerator, 1);
  assert.equal(r.dDenominator, 1);
  assert.equal(r.d, 1);
  assert.equal(r.firstMaxValue, 1);
});

test("完全分离：D=1，首次达到位置正确", () => {
  const r = ksDistance([1, 2], [3, 4]);
  assert.equal(r.dNumerator, 4);
  assert.equal(r.dDenominator, 4);
  assert.equal(r.d, 1);
  assert.equal(r.firstMaxValue, 2);
});

test("完全相同：D=0", () => {
  const r = ksDistance([5, 5], [5, 5]);
  assert.equal(r.dNumerator, 0);
  assert.equal(r.d, 0);
});

test("大量并列值：同步跃变，D=1/3", () => {
  // 手算：值1处 A累计2 B累计1 -> |3*2-3*1|/9 = 3/9；值2处两边都累计满 -> 0
  const r = ksDistance([1, 1, 2], [1, 2, 2]);
  assert.equal(r.dNumerator, 3);
  assert.equal(r.dDenominator, 9);
  assert.equal(r.firstMaxIndex, 0);
  assert.equal(r.firstMaxValue, 1);
  // 确认没有因为逐条推进并列值而得到更大的距离
  assert.ok(r.dNumerator < 6);
});

test("负数观测", () => {
  const r = ksDistance([-2, -1], [0, 1]);
  assert.equal(r.d, 1);
  assert.equal(r.firstMaxValue, -1);
});

test("样本内重排不影响结果", () => {
  const r1 = ksDistance([1, 1, 2], [1, 2, 2]);
  const r2 = ksDistance([2, 1, 1], [2, 2, 1]);
  assert.deepEqual(r1.table, r2.table);
  assert.equal(r1.dNumerator, r2.dNumerator);
});

test("交换两组：D 不变，有符号差反转", () => {
  const r1 = ksDistance([1, 1, 2], [1, 2, 2]);
  const r2 = ksDistance([1, 2, 2], [1, 1, 2]);
  assert.equal(r1.dNumerator, r2.dNumerator);
  assert.equal(r1.dDenominator, r2.dDenominator);
  for (let i = 0; i < r1.table.length; i++) {
    assert.equal(r1.table[i].diffNumerator + 0, -r2.table[i].diffNumerator + 0);
  }
});

test("不同样本量：n=1, m=2", () => {
  const r = ksDistance([1], [2, 3]);
  // 手算：值1处 2*cumA - 1*cumB = 2，分母 n*m = 2
  assert.equal(r.dNumerator, 2);
  assert.equal(r.dDenominator, 2);
  assert.equal(r.d, 1);
});
