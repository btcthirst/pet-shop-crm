import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests talk to the dev database, so `.env` has to be loaded first.
    setupFiles: ["tests/setup-env.ts"],
    // Every integration file writes to the same database; a global count (order totals,
    // catalogue size) would race with a fixture inserted by the file running next to it.
    fileParallelism: false,
    // Integration tests do many sequential round trips to a remote Postgres (Neon), where a
    // single transaction with journal writes can exceed the 5s default on a slow network.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/features/**/service.ts", "src/features/**/status.ts", "src/lib/money.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
