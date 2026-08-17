import { z } from "zod";
import { parseEnv } from "@sso/shared";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().min(1),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  INTERNAL_HMAC_SECRET: z.string().min(16),
  INTERNAL_HMAC_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  SYNC_WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(3002),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(env: Record<string, string | undefined> = process.env): Env {
  return parseEnv(envSchema, env);
}
