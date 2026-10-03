// 报告构建：把计算结果整理为可 JSON 序列化的结构（BigInt 以字符串表示）。

import { ksDistance, KsResult } from "./ks.js";
import { exactPermutationTest, PermutationResult } from "./permutation.js";
import { ALGO_VERSION } from "./db.js";

export function distanceJson(r: KsResult) {
  return {
    n: r.n,
    m: r.m,
    denominator: r.denominator,
    maxNumerator: r.maxNumerator.toString(),
    D: r.D,
    firstMaxValue: r.firstMaxValue,
  };
}

export function ecdfJson(r: KsResult) {
  return r.table.map((row) => ({
    value: row.value,
    countA: row.countA,
    countB: row.countB,
    cumA: row.cumA,
    cumB: row.cumB,
    propA: row.propA,
    propB: row.propB,
    diffNumerator: row.diffNumerator.toString(),
    absDiff: row.absDiff,
  }));
}

export function permutationJson(p: PermutationResult) {
  return {
    n: p.n,
    m: p.m,
    totalAssignments: p.totalAssignments.toString(),
    binomialCheck: p.binomial.toString(),
    observedNumerator: p.observedNumerator.toString(),
    observedD: p.observedD,
    tailCount: p.tailCount.toString(),
    pValue: {
      numerator: p.pValue.numerator.toString(),
      denominator: p.pValue.denominator.toString(),
      reduced: `${p.pValue.reducedNumerator}/${p.pValue.reducedDenominator}`,
      decimal: p.pValue.decimal,
    },
  };
}

export function distributionJson(p: PermutationResult) {
  return p.distribution.map((d) => ({
    numerator: d.numerator.toString(),
    D: d.D,
    count: d.count.toString(),
    probability: Number(d.count) / Number(p.totalAssignments),
  }));
}

export function buildReport(name: string, a: number[], b: number[]) {
  const ks = ksDistance(a, b);
  const perm = exactPermutationTest(a, b);
  return {
    algoVersion: ALGO_VERSION,
    sampleName: name,
    groupA: a,
    groupB: b,
    distance: distanceJson(ks),
    ecdfTable: ecdfJson(ks),
    test: permutationJson(perm),
    distribution: distributionJson(perm),
    interpretation: {
      assumption:
        "前提：在两组来自同一分布的原假设下，组标签可交换，因此固定合并样本后，" +
        "C(n+m, n) 种标签分配等可能。本检验正是条件于合并样本的精确标签置换检验。",
      pValue:
        "p 值 = 在所有等权标签分配中，KS 距离 D 大于或等于观测 D 的比例（含观测自身）。" +
        "小 p 值提示两组分布存在差异；大 p 值仅表示数据与该原假设相容，" +
        "不能据此断言两组分布相同。",
      scope:
        "本服务仅做小样本精确计算（合并总数 ≤ 16），不做渐近近似、蒙特卡洛或临床结论。",
    },
  };
}

export function computeDistance(name: string, a: number[], b: number[]) {
  const ks = ksDistance(a, b);
  return { algoVersion: ALGO_VERSION, sampleName: name, ...distanceJson(ks) };
}

export function computeEcdf(name: string, a: number[], b: number[]) {
  const ks = ksDistance(a, b);
  return { algoVersion: ALGO_VERSION, sampleName: name, table: ecdfJson(ks) };
}

export function computeDistribution(name: string, a: number[], b: number[]) {
  const perm = exactPermutationTest(a, b);
  return {
    algoVersion: ALGO_VERSION,
    sampleName: name,
    totalAssignments: perm.totalAssignments.toString(),
    distribution: distributionJson(perm),
  };
}
