import type { FastifyInstance } from "fastify";
import { randomToken, sha256Base64Url } from "@sso/shared";
import * as activityService from "../services/activity-service.js";
import * as oauthStateService from "../services/oauth-state-service.js";

const APPLICATION_ID = "app-b";

export async function loginRoutes(server: FastifyInstance): Promise<void> {
  server.get("/login", async (request, reply) => {
    // Generate a fresh PKCE pair + state, persist them, then redirect the browser to the Auth Provider's authorize endpoint.
    const codeVerifier = randomToken(32);
    const codeChallenge = sha256Base64Url(codeVerifier);

    const { state } = await oauthStateService.createOAuthState(server.db, {
      applicationId: APPLICATION_ID,
      codeVerifier,
    });

    await activityService.writeActivity(server.db, {
      applicationId: APPLICATION_ID,
      event: "redirect_to_auth",
      correlationId: state,
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: server.config.APP_B_CLIENT_ID,
      redirect_uri: `${server.config.APP_B_PUBLIC_URL}/callback`,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return reply.redirect(
      `${server.config.AUTH_SERVER_PUBLIC_URL}/oauth/authorize?${params.toString()}`,
    );
  });
}
