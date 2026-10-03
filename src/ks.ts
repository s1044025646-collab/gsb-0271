// 两样本 KS 距离核心计算。
// 关键约定：在并列值处两组同步跃变；距离用整数累计计数构造公共分母 n*m，
// 所有比较均为整数比较，不依赖浮点相等。

export interface EcdfRow {
  value: number;        // 合并样本中的不同观测值
  countA: number;       // 第一组等于该值的观测数
  countB: number;       // 第二组等于该值的观测数
  cumA: number;         // 第一组累计计数
  cumB: number;         // 第二组累计计数
  propA: number;        // cumA / n（仅供阅读）
  propB: number;        // cumB / m（仅供阅读）
  diffNumerator: bigint;   // cumA*m - cumB*n（公共分母 n*m 的分子，带符号）
  absDiff: number;      // |diff| / (n*m)（仅供阅读）
}

export interface KsResult {
  n: number;
  m: number;
  denominator: number;      // n * m
  maxNumerator: bigint;     // max |cumA*m - cumB*n|
  D: number;                // maxNumerator / (n*m)，仅供阅读
  firstMaxValue: number;    // 首次达到最大差的位置（合并不同值中的最小者）
  table: EcdfRow[];
}

export function ksDistance(a: number[], b: number[]): KsResult {
  const n = a.length;
  const m = b.length;
  const denom = n * m;

  // 按值分组统计两组计数
  const counts = new Map<number, { ca: number; cb: number }>();
  for (const v of a) {
    const e = counts.get(v) ?? { ca: 0, cb: 0 };
    e.ca++;
    counts.set(v, e);
  }
  for (const v of b) {
    const e = counts.get(v) ?? { ca: 0, cb: 0 };
    e.cb++;
    counts.set(v, e);
  }
  const values = [...counts.keys()].sort((x, y) => x - y);

  const table: EcdfRow[] = [];
  let cumA = 0;
  let cumB = 0;
  let maxNum = 0n;
  let firstMaxValue = values[0];
  for (const v of values) {
    const { ca, cb } = counts.get(v)!;
    // 同步跃变：先把两组在该值处的所有观测同时计入，再比较
    cumA += ca;
    cumB += cb;
    const diff = BigInt(cumA) * BigInt(m) - BigInt(cumB) * BigInt(n);
    const abs = diff < 0n ? -diff : diff;
    if (abs > maxNum) {
      maxNum = abs;
      firstMaxValue = v;
    }
    table.push({
      value: v,
      countA: ca,
      countB: cb,
      cumA,
      cumB,
      propA: cumA / n,
      propB: cumB / m,
      diffNumerator: diff,
      absDiff: Number(abs) / denom,
    });
  }

  return {
    n,
    m,
    denominator: denom,
    maxNumerator: maxNum,
    D: Number(maxNum) / denom,
    firstMaxValue,
    table,
  };
}
