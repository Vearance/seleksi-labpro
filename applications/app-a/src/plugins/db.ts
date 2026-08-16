import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { createPrismaClient } from "@sso/db-local";

/**
 * Prisma client for the local (App A/B shared) database. fastify-plugin breaks
 * encapsulation so every route/plugin can access `fastify.db`.
 */
export default fp(
  async (fastify: FastifyInstance) => {
    const db = createPrismaClient(fastify.config.DATABASE_URL_LOCAL);
    fastify.decorate("db", db);

    fastify.addHook("onClose", async () => {
      await db.$disconnect();
    });
  },
  { name: "db" },
);
