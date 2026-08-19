import { z } from "zod";
import { parseEnv } from "@sso/shared";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  AUTH_SERVER_HOST: z.string().default("0.0.0.0"),
  AUTH_SERVER_PORT: z.coerce.number().int().positive().default(3000),
  AUTH_SERVER_COOKIE_NAME: z.string().min(1).default("auth_sid"),
  AUTH_SERVER_COOKIE_SECRET: z.string().min(16),
  AUTH_SERVER_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SERVER_INTERNAL_URL: z.string().url().default("http://auth-server:3000"),
  AUTH_SERVER_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(480),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().min(1),
  ADMIN_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(env: Record<string, string | undefined> = process.env): Env {
  return parseEnv(envSchema, env);
}
