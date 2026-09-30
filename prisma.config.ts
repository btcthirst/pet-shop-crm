import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads connection strings from the `datasource` block, so the CLI
// (migrations, seed, studio) is pointed at DIRECT_URL here.
// The Neon dev branch wins when DIRECT_URL_DEV is set, so local commands never touch
// demo data; on Vercel and in CI the `*_DEV` variables are absent and the main
// database is used.
const directUrl =
  [process.env.DIRECT_URL_DEV, process.env.DIRECT_URL].find(
    (value) => typeof value === "string" && value.length > 0,
  ) ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: directUrl,
  },
});
