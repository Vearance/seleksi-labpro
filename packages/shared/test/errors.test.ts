import { describe, expect, it } from "vitest";
import { ApiError, toErrorBody } from "../src/errors.js";

describe("ApiError", () => {
  it("carries code, status, and message", () => {
    const err = new ApiError("nope", { statusCode: 404, code: "NOT_FOUND" });
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("nope");
  });

  it("defaults to 400 / BAD_REQUEST", () => {
    const err = new ApiError("invalid");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
  });

  it("serializes to the standard error body", () => {
    const err = new ApiError("nope", { statusCode: 404, code: "NOT_FOUND" });
    expect(err.toErrorBody("req-1")).toEqual({
      error: { code: "NOT_FOUND", message: "nope", requestId: "req-1" },
    });
  });
});

describe("toErrorBody", () => {
  it("preserves ApiError code/message", () => {
    const body = toErrorBody(new ApiError("invalid"), "req-2");
    expect(body).toEqual({
      error: { code: "BAD_REQUEST", message: "invalid", requestId: "req-2" },
    });
  });

  it("collapses unexpected errors to a generic 500 without leaking internals", () => {
    const body = toErrorBody(new Error("postgres password=supersecret stack trace"), "req-3");
    expect(body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId: "req-3",
      },
    });
  });
});
