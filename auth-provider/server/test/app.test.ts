import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/app.js";
import type { Env } from "../src/config.js";

const testConfig: Env = {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  AUTH_SERVER_HOST: "0.0.0.0",
  AUTH_SERVER_PORT: 3000,
  AUTH_SERVER_COOKIE_NAME: "auth_sid",
  AUTH_SERVER_COOKIE_SECRET: "test-secret-at-least-32-characters-long!!",
  AUTH_SERVER_PUBLIC_URL: "http://localhost:3000",
  AUTH_SERVER_INTERNAL_URL: "http://auth-server:3000",
  AUTH_SERVER_SESSION_TTL_MINUTES: 480,
  DATABASE_URL: "postgresql://sso:password@localhost:5432/sso_primary",
  RABBITMQ_URL: "amqp://localhost:5672/",
  ADMIN_SESSION_TTL_SECONDS: 3600,
  ACCESS_TOKEN_TTL_SECONDS: 3600,
};

describe("auth-server", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = buildServer({ config: testConfig, logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it("GET /health/live returns 200 without touching dependencies", async () => {
    const res = await server.inject({ method: "GET", url: "/health/live" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("GET /health/ready reports degraded when dependencies are unreachable", async () => {
    // In unit tests there is no DB and no broker, so readiness must be 503
    // and name the failing components without leaking internals.
    const res = await server.inject({ method: "GET", url: "/health/ready" });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database.ok).toBe(false);
    expect(body.checks.broker.ok).toBe(false);
  });

  it("unknown route returns the standard 404 error format", async () => {
    const res = await server.inject({ method: "GET", url: "/does-not-exist" });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBeTruthy();
  });

  it("unexpected errors collapse to generic 500 without leaking details", async () => {
    const s = buildServer({ config: testConfig, logger: false });
    s.get("/boom", async () => {
      throw new Error("secret password=supersecret");
    });
    await s.ready();

    const res = await s.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("An unexpected error occurred");
    expect(JSON.stringify(body)).not.toContain("supersecret");

    await s.close();
  });
});
