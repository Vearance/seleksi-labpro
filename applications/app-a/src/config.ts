import { z } from "zod";
import { parseEnv } from "@sso/shared";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  APP_A_HOST: z.string().default("0.0.0.0"),
  APP_A_PORT: z.coerce.number().int().positive().default(4001),
  // Browser-facing base URL (outside the compose network).
  APP_A_PUBLIC_URL: z.string().url().default("http://localhost:4001"),
  // Service-to-service base URL (inside the compose network).
  APP_A_INTERNAL_URL: z.string().url().default("http://app-a:4001"),
  // Auth Provider URLs: PUBLIC for browser redirects, INTERNAL for server-to-server calls.
  AUTH_SERVER_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SERVER_INTERNAL_URL: z.string().url().default("http://auth-server:3000"),
  DATABASE_URL_LOCAL: z.string().url(),
  APP_A_CLIENT_ID: z.string().min(1),
  APP_A_CLIENT_SECRET: z.string().min(1),
  APP_A_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28800),
  INTERNAL_HMAC_SECRET: z.string().min(16),
  INTERNAL_HMAC_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(env: Record<string, string | undefined> = process.env): Env {
  return parseEnv(envSchema, env);
}
