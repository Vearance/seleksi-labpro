import type { FastifyServerOptions } from "fastify";
import type { Env } from "./config.js";

/**
 * Builds the Fastify logger options per environment. Development uses
 * pretty-printed logs; production emits structured JSON at the configured
 * level; test is silent.
 */
export function buildLoggerConfig(env: Env): FastifyServerOptions["logger"] {
  switch (env.NODE_ENV) {
    case "development":
      return {
        level: "debug",
        transport: {
          target: "pino-pretty",
          options: {
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
      };
    case "test":
      return { level: "silent" };
    case "production":
      return { level: env.LOG_LEVEL };
  }
}
