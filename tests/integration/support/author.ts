import { db } from "@/lib/db";

/**
 * Every integration suite needs an ADMIN id to attribute stock movements and orders to, but none of
 * them may depend on `pnpm db:seed`: CI runs the suite straight after the migrations, so a seeded
 * lookup would fail on the empty database there. An existing author is reused when the database has
 * one (a seeded Neon dev branch), otherwise a throwaway account is created and the caller removes it
 * in `afterAll` — the password hash is never checked because nothing signs in.
 */
export type TestAuthor = { id: string; created: boolean };

export async function ensureTestAuthor(tag: string): Promise<TestAuthor> {
  const existing = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });

  if (existing) {
    return { id: existing.id, created: false };
  }

  const author = await db.user.create({
    data: {
      email: `${tag}@petshop.local`,
      name: "Тестовий Admin",
      role: "ADMIN",
      passwordHash: "not-used",
    },
    select: { id: true },
  });

  return { id: author.id, created: true };
}
