import type { FastifyInstance } from "fastify";
import { COOKIE_NAMES } from "@sso/shared";
import * as codeService from "../../services/code-service.js";
import * as sessionService from "../../services/session-service.js";
import * as auditService from "../../services/audit-service.js";
import * as policyService from "../../services/policy-service.js";
import { renderErrorPage } from "../../login-page.js";

function buildRedirect(baseUri: string, params: Record<string, string | undefined>): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value!)}`)
    .join("&");
  const separator = baseUri.includes("?") ? "&" : "?";
  return `${baseUri}${separator}${query}`;
}

export async function oauthAuthorizeRoutes(server: FastifyInstance): Promise<void> {
  server.get("/authorize", async (request, reply) => {
    const q = request.query as {
      client_id?: string;
      redirect_uri?: string;
      response_type?: string;
      scope?: string;
      state?: string;
      code_challenge?: string;
      code_challenge_method?: string;
    };

    if (q.response_type !== "code") {
      return reply
        .status(400)
        .type("text/html")
        .send(renderErrorPage("Invalid request: response_type must be 'code'."));
    }

    if (!q.client_id) {
      return reply
        .status(400)
        .type("text/html")
        .send(renderErrorPage("Invalid request: client_id is required."));
    }

    const application = await server.db.application.findUnique({
      where: { clientId: q.client_id },
      include: { redirectUris: { select: { uri: true } } },
    });
    if (!application) {
      return reply
        .status(400)
        .type("text/html")
        .send(renderErrorPage("Invalid request: unknown client."));
    }

    const redirectUri = q.redirect_uri;
    if (!redirectUri || !application.redirectUris.some((r) => r.uri === redirectUri)) {
      return reply
        .status(400)
        .type("text/html")
        .send(renderErrorPage("Invalid request: redirect_uri is not registered."));
    }

    const codeChallenge = q.code_challenge;
    const codeChallengeMethod = q.code_challenge_method ?? "S256";
    if (!codeChallenge || codeChallengeMethod !== "S256") {
      return reply
        .status(400)
        .type("text/html")
        .send(renderErrorPage("Invalid request: PKCE is required."));
    }

    // Central session check — if absent, redirect to the login page and come
    // back to this exact authorize URL after sign-in.
    const token = request.cookies[COOKIE_NAMES.authSession];
    const validSession = token ? await sessionService.getValidSession(server.db, token) : null;
    if (!validSession) {
      return reply.redirect(`/login?return_to=${encodeURIComponent(request.url)}`);
    }

    // Policy evaluation (7 steps) — deny redirects ONLY to the validated URI.
    const evaluation = await policyService.evaluateAccessForRequest(server.db, {
      clientId: application.clientId,
      userId: validSession.user.id,
      redirectUri,
    });

    if (!evaluation.allowed) {
      await auditService.writeAudit(server.db, {
        eventType: "access_denied",
        userId: validSession.user.id,
        applicationId: application.id,
        sessionId: validSession.session.id,
        result: "denied",
        metadata: { reason: evaluation.reason },
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      return reply.redirect(buildRedirect(redirectUri, { error: "access_denied", state: q.state }));
    }

    const { code } = await codeService.issueAuthorizationCode(server.db, {
      userId: validSession.user.id,
      applicationId: application.id,
      ssoSessionId: validSession.session.id,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
    });

    await auditService.writeAudit(server.db, {
      eventType: "authorization_code_issued",
      userId: validSession.user.id,
      applicationId: application.id,
      sessionId: validSession.session.id,
      result: "success",
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.redirect(buildRedirect(redirectUri, { code, state: q.state }));
  });
}
