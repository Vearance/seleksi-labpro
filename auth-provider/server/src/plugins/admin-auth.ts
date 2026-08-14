import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiError, COOKIE_NAMES } from "@sso/shared";
import { isAdmin } from "../services/admin-service.js";

interface AdminCookiePayload {
  userId?: string;
  exp?: number;
}

function unauthorizedError(): ApiError {
  return new ApiError("Unauthorized", { statusCode: 401, code: "UNAUTHORIZED" });
}

/**
 * preHandler guard for `/admin/*` routes. Verifies the signed admin cookie,
 * checks expiry, then re-checks the user is still an active admin.
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const cookieValue = request.cookies[COOKIE_NAMES.adminSession];
  if (!cookieValue) throw unauthorizedError();

  const { valid, value } = reply.unsignCookie(cookieValue);
  if (!valid || value === null) throw unauthorizedError();

  let payload: AdminCookiePayload;
  try {
    payload = JSON.parse(value) as AdminCookiePayload;
  } catch {
    throw unauthorizedError();
  }

  if (
    typeof payload.userId !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp < Math.floor(Date.now() / 1000)
  ) {
    throw unauthorizedError();
  }

  const admin = await isAdmin(request.server.db, payload.userId);
  if (!admin) throw unauthorizedError();

  request.adminUserId = payload.userId;
}
