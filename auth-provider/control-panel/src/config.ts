import { z } from "zod";
import { parseEnv } from "@sso/shared";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  CONTROL_PANEL_HOST: z.string().default("0.0.0.0"),
  CONTROL_PANEL_PORT: z.coerce.number().int().positive().default(3001),
  CONTROL_PANEL_PUBLIC_URL: z.string().url().default("http://localhost:3001"),
  AUTH_SERVER_INTERNAL_URL: z.string().url().default("http://auth-server:3000"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(env: Record<string, string | undefined> = process.env): Env {
  return parseEnv(envSchema, env);
}
