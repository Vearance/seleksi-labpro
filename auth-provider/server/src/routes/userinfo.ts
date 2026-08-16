import type { FastifyInstance } from "fastify";
import { getUserInfo } from "../services/token-service.js";

export async function userinfoRoutes(server: FastifyInstance): Promise<void> {
  server.get("/userinfo", async (request, reply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;

    if (!token) {
      return reply.status(401).header("WWW-Authenticate", "Bearer").send({
        error: { code: "UNAUTHORIZED", message: "Missing bearer token", requestId: request.id },
      });
    }

    const info = await getUserInfo(server.db, token);
    if (!info) {
      return reply
        .status(401)
        .header("WWW-Authenticate", 'Bearer error="invalid_token"')
        .send({
          error: { code: "UNAUTHORIZED", message: "Invalid access token", requestId: request.id },
        });
    }

    return info;
  });
}
