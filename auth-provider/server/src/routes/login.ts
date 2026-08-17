import type { FastifyInstance } from "fastify";
import { ApiError, COOKIE_NAMES } from "@sso/shared";
import * as authService from "../services/auth-service.js";
import * as sessionService from "../services/session-service.js";
import * as auditService from "../services/audit-service.js";
import { renderLoginPage, renderSsoHomePage } from "../login-page.js";

const loginSchema = {
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 1 },
    },
  },
} as const;

export async function loginRoutes(server: FastifyInstance): Promise<void> {
  // SSO home: shows the signed-in identity + global logout (the "Auth Provider page").
  server.get("/", async (request, reply) => {
    const token = request.cookies[COOKIE_NAMES.authSession];
    const valid = token ? await sessionService.getValidSession(server.db, token) : null;
    if (!valid) {
      return reply.redirect("/login");
    }
    const user = await server.db.user.findUnique({
      where: { id: valid.user.id },
      select: { name: true, email: true },
    });
    return reply
      .type("text/html")
      .send(renderSsoHomePage(user?.name ?? "User", user?.email ?? ""));
  });

  server.get("/login", async (request, reply) => {
    const { return_to: returnTo } = request.query as { return_to?: string };
    const safeReturnTo = returnTo && returnTo.startsWith("/oauth/authorize") ? returnTo : "/";
    return reply.type("text/html").send(renderLoginPage(safeReturnTo));
  });

  server.post(
    "/login",
    { schema: loginSchema },
    async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };
      const ipAddress = request.ip;
      const userAgent = request.headers["user-agent"];

      const result = await authService.verifyCredentials(server.db, email, password);

      if (!result.ok) {
        await auditService.writeAudit(server.db, {
          eventType: "login_failed",
          userId: result.user?.id ?? null,
          result: "failed",
          ipAddress,
          userAgent,
        });
        throw new ApiError("Invalid credentials", { statusCode: 401, code: "UNAUTHORIZED" });
      }

      const ttlSeconds = server.config.AUTH_SERVER_SESSION_TTL_MINUTES * 60;
      const { sessionId, token } = await sessionService.createSession(server.db, {
        userId: result.user.id,
        userAgent,
        ipAddress,
        ttlSeconds,
      });

      await auditService.writeAudit(server.db, {
        eventType: "login_success",
        userId: result.user.id,
        sessionId,
        result: "success",
        ipAddress,
        userAgent,
      });

      await server.db.user.update({
        where: { id: result.user.id },
        data: { lastLoginAt: new Date() },
      });

      reply.setCookie(COOKIE_NAMES.authSession, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: ttlSeconds,
        secure: server.config.NODE_ENV === "production",
      });

      return { user: { id: result.user.id, name: result.user.name, email: result.user.email } };
    },
  );
}
