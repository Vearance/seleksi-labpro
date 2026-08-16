import type { FastifyInstance } from "fastify";
import { COOKIE_NAMES } from "@sso/shared";
import { renderErrorPage } from "../error-page.js";
import * as activityService from "../services/activity-service.js";
import * as localSessionService from "../services/local-session-service.js";
import * as oauthStateService from "../services/oauth-state-service.js";

const APPLICATION_ID = "app-b";

interface TokenResponse {
  access_token?: string;
}

interface UserInfoResponse {
  sub?: string;
  sid?: string;
  name?: string;
  email?: string;
  groups?: string[];
}

export async function callbackRoutes(server: FastifyInstance): Promise<void> {
  server.get("/callback", async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };

    if (!state) {
      return reply.type("text/html").send(renderErrorPage("Invalid login session."));
    }

    const oauthState = await oauthStateService.consumeOAuthState(server.db, state, APPLICATION_ID);
    if (!oauthState) {
      return reply.type("text/html").send(renderErrorPage("Login session expired or already used."));
    }

    await activityService.writeActivity(server.db, {
      applicationId: APPLICATION_ID,
      event: "code_received",
      correlationId: state,
    });

    if (!code) {
      return reply.type("text/html").send(renderErrorPage("Authorization code missing."));
    }

    // Exchange the code server-to-server
    let tokenRes: Response;
    try {
      tokenRes = await fetch(`${server.config.AUTH_SERVER_INTERNAL_URL}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          client_id: server.config.APP_B_CLIENT_ID,
          client_secret: server.config.APP_B_CLIENT_SECRET,
          redirect_uri: `${server.config.APP_B_PUBLIC_URL}/callback`,
          code_verifier: oauthState.codeVerifier,
        }),
      });
    } catch {
      return reply.type("text/html").send(renderErrorPage("Could not reach the identity provider."));
    }

    if (!tokenRes.ok) {
      return reply.type("text/html").send(renderErrorPage("Authorization code was not accepted."));
    }

    const tokenData = (await tokenRes.json()) as TokenResponse;
    if (!tokenData.access_token) {
      return reply.type("text/html").send(renderErrorPage("Identity provider returned no token."));
    }

    // Fetch the identity from the provider's userinfo endpoint.
    let userinfoRes: Response;
    try {
      userinfoRes = await fetch(`${server.config.AUTH_SERVER_INTERNAL_URL}/userinfo`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
    } catch {
      return reply.type("text/html").send(renderErrorPage("Could not fetch user info."));
    }

    if (!userinfoRes.ok) {
      return reply.type("text/html").send(renderErrorPage("Could not fetch user info."));
    }

    await activityService.writeActivity(server.db, {
      applicationId: APPLICATION_ID,
      event: "userinfo_fetched",
      correlationId: state,
    });

    const userinfo = (await userinfoRes.json()) as UserInfoResponse;
    if (!userinfo.sub || !userinfo.sid || !userinfo.name || !userinfo.email) {
      return reply.type("text/html").send(renderErrorPage("Incomplete user info."));
    }

    // Create the local session + refresh the profile cache.
    const ttlSeconds = server.config.APP_B_SESSION_TTL_SECONDS;
    const { token } = await localSessionService.createLocalSession(server.db, {
      applicationId: APPLICATION_ID,
      externalUserId: userinfo.sub,
      centralSessionId: userinfo.sid,
      ttlSeconds,
    });

    await localSessionService.upsertProfileCache(server.db, {
      externalUserId: userinfo.sub,
      name: userinfo.name,
      email: userinfo.email,
      groups: userinfo.groups ?? [],
    });

    await activityService.writeActivity(server.db, {
      applicationId: APPLICATION_ID,
      event: "session_created",
      correlationId: state,
    });

    reply.setCookie(COOKIE_NAMES.appB, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ttlSeconds,
      secure: server.config.NODE_ENV === "production",
    });

    return reply.redirect("/");
  });
}
