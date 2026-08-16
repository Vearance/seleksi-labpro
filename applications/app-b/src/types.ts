import type { PrismaClient } from "@sso/db-local";
import type { Env } from "./config.js";

declare module "fastify" {
  interface FastifyInstance {
    config: Env;
    db: PrismaClient;
  }
}
