import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads connection strings from the `datasource` block, so the CLI
// (migrations, seed, studio) is pointed at DIRECT_URL first and falls back to DATABASE_URL.
const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl,
  },
});
