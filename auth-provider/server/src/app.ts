import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import type { Env } from "./config.js";
import "./types.js";
import { buildLoggerConfig } from "./logger.js";
import dbPlugin from "./plugins/db.js";
import metricsPlugin from "./plugins/metrics.js";
import { errorHandler } from "./plugins/error-handler.js";
import { notFoundHandler } from "./plugins/not-found.js";
import { healthRoutes } from "./routes/health.js";
import { metricsRoutes } from "./routes/metrics.js";
import { loginRoutes } from "./routes/login.js";
import { logoutRoutes } from "./routes/logout.js";
import { oauthAuthorizeRoutes } from "./routes/oauth/authorize.js";
import { oauthTokenRoutes } from "./routes/oauth/token.js";
import { userinfoRoutes } from "./routes/userinfo.js";
import { adminLoginRoutes } from "./routes/admin/login.js";
import { adminMeRoutes } from "./routes/admin/me.js";
import { adminLogoutRoutes } from "./routes/admin/logout.js";
import { adminUsersRoutes } from "./routes/admin/users.js";
import { adminGroupsRoutes } from "./routes/admin/groups.js";
import { adminMembershipRoutes } from "./routes/admin/memberships.js";
import { adminApplicationsRoutes } from "./routes/admin/applications.js";
import { adminPoliciesRoutes } from "./routes/admin/policies.js";

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
  server.register(metricsPlugin);
  server.register(healthRoutes);
  server.register(metricsRoutes);
  server.register(loginRoutes);
  server.register(logoutRoutes);
  server.register(oauthAuthorizeRoutes, { prefix: "/oauth" });
  server.register(oauthTokenRoutes, { prefix: "/oauth" });
  server.register(userinfoRoutes);

  server.register(adminLoginRoutes, { prefix: "/admin" });
  server.register(adminMeRoutes, { prefix: "/admin" });
  server.register(adminLogoutRoutes, { prefix: "/admin" });
  server.register(adminUsersRoutes, { prefix: "/admin" });
  server.register(adminGroupsRoutes, { prefix: "/admin" });
  server.register(adminMembershipRoutes, { prefix: "/admin" });
  server.register(adminApplicationsRoutes, { prefix: "/admin" });
  server.register(adminPoliciesRoutes, { prefix: "/admin" });

  server.setErrorHandler(errorHandler);
  server.setNotFoundHandler(notFoundHandler);

  return server;
}
