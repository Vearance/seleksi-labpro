import closeWithGrace from "close-with-grace";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./config.js";
import { buildServer } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

const config = loadEnv();
const server = buildServer({ config });

closeWithGrace({ delay: 10_000 }, async ({ signal, err }) => {
  if (err) {
    server.log.error({ err }, "server closing due to error");
  } else {
    server.log.info({ signal }, "server closing due to signal");
  }
  await server.close();
});

try {
  await server.listen({ port: config.CONTROL_PANEL_PORT, host: config.CONTROL_PANEL_HOST });
} catch (err) {
  server.log.error({ err }, "failed to start server");
  process.exit(1);
}
