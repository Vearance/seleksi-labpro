import type { PrismaClient } from "@sso/db";
import type { Env } from "./config.js";

declare module "fastify" {
  interface FastifyInstance {
    config: Env;
    db: PrismaClient;
  }

  interface FastifyRequest {
    adminUserId?: string;
  }
}
