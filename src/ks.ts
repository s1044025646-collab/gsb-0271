/**
 * 两样本 Kolmogorov–Smirnov 距离。
 *
 * 关键点：在合并样本的每个不同观测值处，两组中所有等于该值的观测
 * 同时跃变（同步推进），再计算两边累计比例之差。绝不能在并列值处
 * 先把某一组逐条推进，否则会算出不存在的更大距离。
 *
 * 所有比较都基于整数累计计数：差值分子为 m*ca - n*cb，
 * 公共分母为 n*m，不依赖浮点相等。小数仅用于展示。
 */

export interface KsTableRow {
  /** 合并样本中的不同观测值（升序） */
  value: number;
  /** 第一组在该值处的观测条数 */
  countA: number;
  /** 第二组在该值处的观测条数 */
  countB: number;
  /** 第一组累计计数 */
  cumA: number;
  /** 第二组累计计数 */
  cumB: number;
  /** 有符号差值分子 m*cumA - n*cumB（分母为 n*m） */
  diffNumerator: number;
  /** 绝对差值分子 */
  absDiffNumerator: number;
  /** 仅供阅读的小数形式 |cumA/n - cumB/m| */
  absDiff: number;
}

export interface KsResult {
  n: number;
  m: number;
  /** D 的整数分子（公共分母 n*m） */
  dNumerator: number;
  /** 公共分母 n*m */
  dDenominator: number;
  /** 仅供阅读的小数 D */
  d: number;
  /** 首次达到最大差的位置（合并不同值表中的下标，0 起） */
  firstMaxIndex: number;
  /** 首次达到最大差处的观测值 */
  firstMaxValue: number;
  /** 完整比较表 */
  table: KsTableRow[];
}

export function ksDistance(a: number[], b: number[]): KsResult {
  const n = a.length;
  const m = b.length;
  const denominator = n * m;

  const countA = new Map<number, number>();
  const countB = new Map<number, number>();
  for (const v of a) countA.set(v, (countA.get(v) ?? 0) + 1);
  for (const v of b) countB.set(v, (countB.get(v) ?? 0) + 1);

  const values = [...new Set([...countA.keys(), ...countB.keys()])].sort(
    (x, y) => x - y
  );

  const table: KsTableRow[] = [];
  let cumA = 0;
  let cumB = 0;
  let dNumerator = 0;
  let firstMaxIndex = -1;
  let firstMaxValue = 0;

  values.forEach((value, index) => {
    // 并列值处两组同步跃变
    cumA += countA.get(value) ?? 0;
    cumB += countB.get(value) ?? 0;
    const diffNumerator = m * cumA - n * cumB;
    const absDiffNumerator = Math.abs(diffNumerator);
    table.push({
      value,
      countA: countA.get(value) ?? 0,
      countB: countB.get(value) ?? 0,
      cumA,
      cumB,
      diffNumerator,
      absDiffNumerator,
      absDiff: absDiffNumerator / denominator,
    });
    if (absDiffNumerator > dNumerator) {
      dNumerator = absDiffNumerator;
      firstMaxIndex = index;
      firstMaxValue = value;
    }
  });

  return {
    n,
    m,
    dNumerator,
    dDenominator: denominator,
    d: dNumerator / denominator,
    firstMaxIndex,
    firstMaxValue,
    table,
  };
}
