import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import type { Env } from "./config.js";
import "./types.js";
import { buildLoggerConfig } from "./logger.js";
import dbPlugin from "./plugins/db.js";
import { errorHandler } from "./plugins/error-handler.js";
import { notFoundHandler } from "./plugins/not-found.js";
import { healthRoutes } from "./routes/health.js";
import { adminLoginRoutes } from "./routes/admin/login.js";
import { adminMeRoutes } from "./routes/admin/me.js";

export interface BuildServerOptions {
  config: Env;
  /** Pass `false` in tests to disable logging. Defaults to env-based logger. */
  logger?: boolean;
}

/**
 * `buildServer` factory — reusable and testable (Fastify best practice:
 * create-server rule).
 */
export function buildServer(options: BuildServerOptions): FastifyInstance {
  const { config, logger = true } = options;

  const server = Fastify({
    logger: logger ? buildLoggerConfig(config) : false,
    genReqId: (req) => {
      const header = req.headers["x-request-id"];
      return typeof header === "string" && header.length > 0 ? header : randomUUID();
    },
    onProtoPoisoning: "error",
    onConstructorPoisoning: "error",
    requestTimeout: 120_000,
    bodyLimit: 1_048_576,
    return503OnClosing: true,
    forceCloseConnections: "idle",
  });

  server.decorate("config", config);

  server.register(cookie, { secret: config.AUTH_SERVER_COOKIE_SECRET });
  server.register(dbPlugin);
  server.register(healthRoutes);

  server.register(adminLoginRoutes, { prefix: "/admin" });
  server.register(adminMeRoutes, { prefix: "/admin" });

  server.setErrorHandler(errorHandler);
  server.setNotFoundHandler(notFoundHandler);

  return server;
}
