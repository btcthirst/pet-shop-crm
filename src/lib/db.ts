import { PrismaPg } from "@prisma/adapter-pg";

import { getDatabaseUrl } from "@/lib/env";

import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  // Neon pooler: `sslmode=require` is enough for the pooled endpoint.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
