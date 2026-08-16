import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import type { Env } from "./config.js";
import "./types.js";
import { buildLoggerConfig } from "./logger.js";
import dbPlugin from "./plugins/db.js";
import { errorHandler } from "./plugins/error-handler.js";
import { notFoundHandler } from "./plugins/not-found.js";
import { healthRoutes } from "./routes/health.js";
import { loginRoutes } from "./routes/login.js";
import { callbackRoutes } from "./routes/callback.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    return503OnClosing: true,
    forceCloseConnections: "idle",
  });

  server.decorate("config", config);

  server.register(cookie);
  server.register(dbPlugin);
  server.register(healthRoutes);
  server.register(loginRoutes);
  server.register(callbackRoutes);

  // Serve the built React SPA (web/dist); skipped during backend-only dev.
  const staticRoot = path.resolve(__dirname, "../web/dist");
  if (existsSync(staticRoot)) {
    server.register(fastifyStatic, {
      root: staticRoot,
      prefix: "/",
    });
  }

  server.setErrorHandler(errorHandler);
  server.setNotFoundHandler(notFoundHandler);

  return server;
}
