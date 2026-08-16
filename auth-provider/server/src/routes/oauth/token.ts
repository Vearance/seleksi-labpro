import type { FastifyInstance } from "fastify";
import * as auditService from "../../services/audit-service.js";
import { OAuthError, exchangeAuthorizationCode } from "../../services/token-service.js";

const tokenSchema = {
  body: {
    type: "object",
    properties: {
      grant_type: { type: "string" },
      code: { type: "string" },
      client_id: { type: "string" },
      client_secret: { type: "string" },
      redirect_uri: { type: "string" },
      code_verifier: { type: "string" },
    },
  },
} as const;

export async function oauthTokenRoutes(server: FastifyInstance): Promise<void> {
  server.post("/token", { schema: tokenSchema }, async (request, reply) => {
    const body = request.body as {
      grant_type?: string;
      code?: string;
      client_id?: string;
      client_secret?: string;
      redirect_uri?: string;
      code_verifier?: string;
    };

    if (body.grant_type !== "authorization_code") {
      return reply.status(400).send({
        error: "unsupported_grant_type",
        error_description: "Only authorization_code is supported",
      });
    }

    try {
      const result = await exchangeAuthorizationCode(
        server.db,
        {
          code: body.code,
          clientId: body.client_id,
          clientSecret: body.client_secret,
          redirectUri: body.redirect_uri,
          codeVerifier: body.code_verifier,
        },
        server.config.ACCESS_TOKEN_TTL_SECONDS,
      );

      await auditService.writeAudit(server.db, {
        eventType: "token_issued",
        userId: result.userId,
        applicationId: result.applicationId,
        sessionId: result.sessionId,
        result: "success",
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return {
        access_token: result.accessToken,
        token_type: result.tokenType,
        expires_in: result.expiresIn,
      };
    } catch (err) {
      if (err instanceof OAuthError) {
        await auditService.writeAudit(server.db, {
          eventType: "access_denied",
          result: "denied",
          metadata: { oauthError: err.error },
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        });
        return reply.status(err.statusCode).send({ error: err.error, error_description: err.message });
      }
      throw err;
    }
  });
}
