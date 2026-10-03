import { ApiError } from "./errors";

export const MAX_TOTAL = 16;

export function validateSamples(a: unknown, b: unknown): { a: number[]; b: number[] } {
  for (const [name, arr] of [["groupA", a], ["groupB", b]] as const) {
    if (!Array.isArray(arr)) {
      throw new ApiError("INVALID_INPUT", `${name} 必须是整数数组`);
    }
    if (arr.length < 1) {
      throw new ApiError("INVALID_INPUT", `${name} 至少需要一个观测`);
    }
    for (const v of arr) {
      if (typeof v !== "number" || !Number.isSafeInteger(v)) {
        throw new ApiError(
          "INVALID_INPUT",
          `${name} 中的观测必须是安全整数，收到: ${String(v)}`
        );
      }
    }
  }
  const total = (a as number[]).length + (b as number[]).length;
  if (total > MAX_TOTAL) {
    throw new ApiError(
      "LIMIT_EXCEEDED",
      `合并样本量 ${total} 超过上限 ${MAX_TOTAL}；本服务只做小样本精确计算，不会自动抽样`
    );
  }
  return { a: a as number[], b: b as number[] };
}
