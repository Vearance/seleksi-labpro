import { defineConfig } from "vitest/config";

// Separate from vite.config.ts (which is root-scoped to `web` for the SPA build).
// Vitest prefers this file, so unit tests live under `test/` at the package root.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
