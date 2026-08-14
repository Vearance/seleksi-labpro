import type { FastifyServerOptions } from "fastify";
import type { Env } from "./config.js";

export function buildLoggerConfig(env: Env): FastifyServerOptions["logger"] {
  switch (env.NODE_ENV) {
    case "development":
      return {
        level: "debug",
        transport: {
          target: "pino-pretty",
          options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
        },
      };
    case "test":
      return { level: "silent" };
    case "production":
      return { level: env.LOG_LEVEL };
  }
}
