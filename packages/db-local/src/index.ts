import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient as RawPrismaClient,
  Prisma,
} from "../generated/prisma/client.js";

export type PrismaClient = RawPrismaClient;
export { Prisma };

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new RawPrismaClient({ adapter }) as PrismaClient;
}

export * from "../generated/prisma/client.js";
