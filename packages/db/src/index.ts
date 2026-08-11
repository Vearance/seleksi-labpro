import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient as RawPrismaClient,
  Prisma,
} from "../generated/prisma/client.js";

export type PrismaClient = RawPrismaClient;
export { Prisma };

// This is the main entrypoint for the Prisma client,
// it creates a new Prisma client instance using the PostgreSQL adapter.
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new RawPrismaClient({ adapter }) as PrismaClient;
}

// Re-export generated enums, model types, input types
export * from "../generated/prisma/client.js";
