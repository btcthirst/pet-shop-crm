import type { ZodError } from "zod";

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "INSUFFICIENT_STOCK",
  "INVALID_TRANSITION",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INSUFFICIENT_STOCK: 409,
  INVALID_TRANSITION: 409,
};

/** Fallback for unexpected failures; not part of the documented API contract. */
export const INTERNAL_ERROR_CODE = "INTERNAL_ERROR";

export type ErrorBodyCode = ErrorCode | typeof INTERNAL_ERROR_CODE;

export type ErrorBody = {
  error: {
    code: ErrorBodyCode;
    message: string;
    details?: unknown;
  };
};

/** Domain/HTTP error. Services throw it, Route Handlers translate it into a response. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export type FieldIssue = { path: string; message: string };

/** Maps a Zod failure onto the documented VALIDATION_ERROR contract. */
export function validationError(error: ZodError, message = "Перевірте введені дані"): AppError {
  const fields: FieldIssue[] = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

  return new AppError("VALIDATION_ERROR", message, { fields });
}

/** Maps any thrown value to the `{ error: { code, message, details? } }` contract. */
export function toErrorBody(error: unknown): { status: number; body: ErrorBody } {
  if (isAppError(error)) {
    return { status: error.status, body: error.toBody() };
  }

  return {
    status: 500,
    body: {
      error: {
        code: INTERNAL_ERROR_CODE,
        message: "Unexpected server error",
      },
    },
  };
}
