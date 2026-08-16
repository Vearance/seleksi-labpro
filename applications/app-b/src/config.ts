import { z } from "zod";
import { parseEnv } from "@sso/shared";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  APP_B_HOST: z.string().default("0.0.0.0"),
  APP_B_PORT: z.coerce.number().int().positive().default(4002),
  // Browser-facing base URL (outside the compose network).
  APP_B_PUBLIC_URL: z.string().url().default("http://localhost:4002"),
  // Service-to-service base URL (inside the compose network).
  APP_B_INTERNAL_URL: z.string().url().default("http://app-b:4002"),
  // Auth Provider URLs: PUBLIC for browser redirects, INTERNAL for server-to-server calls.
  AUTH_SERVER_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SERVER_INTERNAL_URL: z.string().url().default("http://auth-server:3000"),
  DATABASE_URL_LOCAL: z.string().url(),
  APP_B_CLIENT_ID: z.string().min(1),
  APP_B_CLIENT_SECRET: z.string().min(1),
  APP_B_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28800),
  INTERNAL_HMAC_SECRET: z.string().min(16),
  INTERNAL_HMAC_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(env: Record<string, string | undefined> = process.env): Env {
  return parseEnv(envSchema, env);
}
