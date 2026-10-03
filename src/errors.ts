export type ErrorCode =
  | "INVALID_INPUT"
  | "LIMIT_EXCEEDED"
  | "NOT_FOUND"
  | "INTERNAL";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}
