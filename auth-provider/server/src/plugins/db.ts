import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { createPrismaClient } from "@sso/db";

/**
 * Prisma client for the primary database, shared app-wide (fastify-plugin
 * breaks encapsulation so every route/plugin can access `fastify.db`).
 */
export default fp(
  async (fastify: FastifyInstance) => {
    const db = createPrismaClient(fastify.config.DATABASE_URL);
    fastify.decorate("db", db);

    fastify.addHook("onClose", async () => {
      await db.$disconnect();
    });
  },
  { name: "db" },
);
