import { config } from "dotenv";

/**
 * Vitest does not load `.env` on its own, and integration tests need the Neon
 * connection string. Missing variables are ignored here; the failing test reports them.
 */
if (!process.env.DATABASE_URL_DEV && !process.env.DATABASE_URL) {
  config({ path: ".env", quiet: true });
}
