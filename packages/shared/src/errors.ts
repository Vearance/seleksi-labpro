/**
 * Standard error format for every HTTP service in the platform:
 * `{ "error": { "code", "message", "requestId" } }`.
 */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export interface ApiErrorOptions {
  /** HTTP status code. Defaults to 400. */
  statusCode?: number;
  /** Stable, machine-readable error code. Defaults to "BAD_REQUEST". */
  code?: string;
  /** Structured details safe to expose to clients (optional). */
  details?: unknown;
  /** Underlying cause — logged server-side, never serialized. */
  cause?: unknown;
}

/** Application-level error that maps 1:1 to the standard error body. */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ApiError";
    this.statusCode = options.statusCode ?? 400;
    this.code = options.code ?? "BAD_REQUEST";
    this.details = options.details;
  }

  toErrorBody(requestId: string): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId,
      },
    };
  }
}

export const INTERNAL_ERROR_CODE = "INTERNAL_ERROR" as const;
export const INTERNAL_ERROR_MESSAGE = "An unexpected error occurred";

/**
 * Builds a standard error body from any thrown value.
 *
 * - `ApiError` is preserved (code, message, status mapped by the caller).
 * - Anything else collapses to a generic 500 so internals never leak.
 */
export function toErrorBody(error: unknown, requestId: string): ErrorBody {
  if (error instanceof ApiError) {
    return error.toErrorBody(requestId);
  }
  return {
    error: {
      code: INTERNAL_ERROR_CODE,
      message: INTERNAL_ERROR_MESSAGE,
      requestId,
    },
  };
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
