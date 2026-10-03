// 输入校验与错误码。

export const MAX_TOTAL = 16;

export type ErrorCode =
  | "INVALID_INPUT"
  | "EMPTY_GROUP"
  | "TOO_MANY_OBSERVATIONS"
  | "NOT_SAFE_INTEGER"
  | "NOT_FOUND";

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}

export function validateGroup(values: unknown, name: string): number[] {
  if (!Array.isArray(values)) {
    throw new ApiError("INVALID_INPUT", `${name} 必须是整数数组`);
  }
  if (values.length === 0) {
    throw new ApiError("EMPTY_GROUP", `${name} 至少需要一个观测`);
  }
  const out: number[] = [];
  for (const v of values) {
    if (typeof v !== "number" || !Number.isSafeInteger(v)) {
      throw new ApiError(
        "NOT_SAFE_INTEGER",
        `${name} 含有非安全整数观测: ${String(v)}`,
      );
    }
    out.push(v);
  }
  return out;
}

export function validateSample(a: unknown, b: unknown): { a: number[]; b: number[] } {
  const ga = validateGroup(a, "groupA");
  const gb = validateGroup(b, "groupB");
  if (ga.length + gb.length > MAX_TOTAL) {
    throw new ApiError(
      "TOO_MANY_OBSERVATIONS",
      `合并观测总数 ${ga.length + gb.length} 超过上限 ${MAX_TOTAL}，本服务只做小规模精确计算，拒绝抽样`,
    );
  }
  return { a: ga, b: gb };
}
