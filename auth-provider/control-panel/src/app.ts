import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import httpProxy from "@fastify/http-proxy";
import fastifyStatic from "@fastify/static";
import type { Env } from "./config.js";
import { buildLoggerConfig } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface BuildServerOptions {
  config: Env;
  logger?: boolean;
}

export function buildServer(options: BuildServerOptions): FastifyInstance {
  const { config, logger = true } = options;

  const server = Fastify({
    logger: logger ? buildLoggerConfig(config) : false,
    return503OnClosing: true,
    forceCloseConnections: "idle",
  });

  // Thin proxy: for all /admin/* route, forward to the auth-server
  server.register(httpProxy, {
    upstream: config.AUTH_SERVER_INTERNAL_URL,
    prefix: "/admin",
    rewritePrefix: "/admin",
    http2: false,
  });

  // Serve the built React SPA (web/dist)
  // Skip registration when not built yet (e.g. during backend-only dev).
  const staticRoot = path.resolve(__dirname, "../web/dist");
  if (existsSync(staticRoot)) {
    server.register(fastifyStatic, {
      root: staticRoot,
      prefix: "/",
    });
  }

  return server;
}
