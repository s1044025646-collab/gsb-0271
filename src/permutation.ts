// 精确标签置换检验。
// 固定两组样本量 n、m，枚举合并样本中哪些位置分配给第一组（其余归第二组），
// 共 C(n+m, n) 种等权分配。位置可区分：即使观测值相同，不同位置分配仍分别计数，
// 保证每种分配等概率 1/C(n+m,n)。

import { ksDistance } from "./ks.js";

export interface Fraction {
  numerator: bigint;
  denominator: bigint;
  reducedNumerator: bigint;
  reducedDenominator: bigint;
  decimal: number;
}

export interface DCount {
  numerator: bigint;   // D 的分子（公共分母 n*m）
  D: number;           // 仅供阅读
  count: bigint;       // 取得该 D 的分配数
}

export interface PermutationResult {
  n: number;
  m: number;
  totalAssignments: bigint;    // 应等于 C(n+m, n)
  binomial: bigint;            // C(n+m, n)，用于校验
  observedNumerator: bigint;   // 原观测 D 的分子
  observedD: number;
  tailCount: bigint;           // D >= 观测 D 的分配数
  pValue: Fraction;
  distribution: DCount[];      // D 的精确计数分布（按 D 升序）
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a === 0n ? 1n : a;
}

export function makeFraction(num: bigint, den: bigint): Fraction {
  const g = gcd(num, den);
  return {
    numerator: num,
    denominator: den,
    reducedNumerator: num / g,
    reducedDenominator: den / g,
    decimal: Number(num) / Number(den),
  };
}

export function binomial(n: number, k: number): bigint {
  let r = 1n;
  for (let i = 0; i < k; i++) {
    r = (r * BigInt(n - i)) / BigInt(i + 1);
  }
  return r;
}

// 生成 positions 中所有大小为 k 的子集（下标组合）
function* combinations(total: number, k: number, start = 0, prefix: number[] = []): Generator<number[]> {
  if (prefix.length === k) {
    yield prefix;
    return;
  }
  for (let i = start; i <= total - (k - prefix.length); i++) {
    yield* combinations(total, k, i + 1, [...prefix, i]);
  }
}

export function exactPermutationTest(a: number[], b: number[]): PermutationResult {
  const n = a.length;
  const m = b.length;
  const pooled = [...a, ...b];
  const total = n + m;

  const observed = ksDistance(a, b);
  const obsNum = observed.maxNumerator;

  const distMap = new Map<bigint, bigint>(); // D 分子 -> 计数
  let tail = 0n;
  let assignments = 0n;

  for (const idxs of combinations(total, n)) {
    const inA = new Set(idxs);
    const pa: number[] = [];
    const pb: number[] = [];
    for (let i = 0; i < total; i++) {
      if (inA.has(i)) pa.push(pooled[i]);
      else pb.push(pooled[i]);
    }
    const r = ksDistance(pa, pb);
    distMap.set(r.maxNumerator, (distMap.get(r.maxNumerator) ?? 0n) + 1n);
    if (r.maxNumerator >= obsNum) tail++;
    assignments++;
  }

  const binom = binomial(total, n);
  if (assignments !== binom) {
    throw new Error(`内部校验失败：枚举数 ${assignments} != 组合数 ${binom}`);
  }

  const distribution: DCount[] = [...distMap.entries()]
    .map(([numerator, count]) => ({
      numerator,
      D: Number(numerator) / (n * m),
      count,
    }))
    .sort((x, y) => (x.numerator < y.numerator ? -1 : 1));

  return {
    n,
    m,
    totalAssignments: assignments,
    binomial: binom,
    observedNumerator: obsNum,
    observedD: observed.D,
    tailCount: tail,
    pValue: makeFraction(tail, assignments),
    distribution,
  };
}
