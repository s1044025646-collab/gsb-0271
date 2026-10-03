/**
 * 精确标签置换检验。
 *
 * 前提：在原假设下两组标签可交换（exchangeable）。固定两组样本量 n、m，
 * 枚举合并样本 N=n+m 个位置中哪些位置分给第一组（其余归第二组），
 * 共 C(N, n) 种等权分配。位置可区分：即使观测值相同，不同位置分配
 * 仍分别计数（保留组合权重），而不是只枚举不同数值分组。
 *
 * 双侧尾部计数 = D >= 观测 D 的分配数；p = 尾部计数 / 总分配数。
 */
import { ksDistance } from "./ks";

export interface Fraction {
  numerator: number;
  denominator: number;
  /** 约分后的分子 */
  reducedNumerator: number;
  /** 约分后的分母 */
  reducedDenominator: number;
  decimal: number;
}

export interface PermutationResult {
  n: number;
  m: number;
  /** 观测 D 的分子（分母 n*m） */
  observedDNumerator: number;
  dDenominator: number;
  observedD: number;
  /** 总分配数 C(N, n) */
  totalAssignments: number;
  /** D >= 观测 D 的分配数 */
  tailCount: number;
  pValue: Fraction;
  /** D 的精确计数分布：分子 -> 分配数 */
  distribution: { dNumerator: number; d: number; count: number }[];
  /** 校验：分布计数之和是否等于 C(N, n) */
  distributionSumOk: boolean;
}

function gcd(x: number, y: number): number {
  let a = Math.abs(x);
  let b = Math.abs(y);
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a === 0 ? 1 : a;
}

export function makeFraction(numerator: number, denominator: number): Fraction {
  const g = gcd(numerator, denominator);
  return {
    numerator,
    denominator,
    reducedNumerator: numerator / g,
    reducedDenominator: denominator / g,
    decimal: numerator / denominator,
  };
}

export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

/** 枚举从 N 个位置中选 n 个的所有组合（回调下标数组） */
function forEachCombination(
  N: number,
  n: number,
  callback: (indices: number[]) => void
): void {
  const chosen: number[] = [];
  const walk = (start: number): void => {
    if (chosen.length === n) {
      callback(chosen);
      return;
    }
    const remaining = n - chosen.length;
    for (let i = start; i <= N - remaining; i++) {
      chosen.push(i);
      walk(i + 1);
      chosen.pop();
    }
  };
  walk(0);
}

export function exactPermutationTest(a: number[], b: number[]): PermutationResult {
  const n = a.length;
  const m = b.length;
  const N = n + m;
  const pooled = [...a, ...b];
  const denominator = n * m;

  const observed = ksDistance(a, b);
  const observedDNumerator = observed.dNumerator;

  const counts = new Map<number, number>();
  let totalAssignments = 0;
  let tailCount = 0;

  const groupA = new Array<number>(n);
  const groupB = new Array<number>(m);

  forEachCombination(N, n, (indices) => {
    const inA = new Set(indices);
    let ia = 0;
    let ib = 0;
    for (let i = 0; i < N; i++) {
      if (inA.has(i)) groupA[ia++] = pooled[i];
      else groupB[ib++] = pooled[i];
    }
    const dNum = ksDistance(groupA, groupB).dNumerator;
    counts.set(dNum, (counts.get(dNum) ?? 0) + 1);
    totalAssignments++;
    if (dNum >= observedDNumerator) tailCount++;
  });

  const expected = binomial(N, n);
  const distribution = [...counts.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([dNumerator, count]) => ({
      dNumerator,
      d: dNumerator / denominator,
      count,
    }));
  const distributionSum = distribution.reduce((s, r) => s + r.count, 0);

  return {
    n,
    m,
    observedDNumerator,
    dDenominator: denominator,
    observedD: observedDNumerator / denominator,
    totalAssignments,
    tailCount,
    pValue: makeFraction(tailCount, totalAssignments),
    distribution,
    distributionSumOk: distributionSum === expected && totalAssignments === expected,
  };
}
