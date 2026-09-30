import { compare, hash } from "bcryptjs";
import { describe, expect, it } from "vitest";

import { loginSchema } from "@/features/auth/schema";

const BCRYPT_COST = 12;

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const passwordHash = await hash("Manager123!", BCRYPT_COST);

    expect(await compare("Manager123!", passwordHash)).toBe(true);
    expect(await compare("manager123!", passwordHash)).toBe(false);
  }, 20_000);

  it("produces a different hash for the same password (salted)", async () => {
    const [first, second] = await Promise.all([
      hash("Admin123!", BCRYPT_COST),
      hash("Admin123!", BCRYPT_COST),
    ]);

    expect(first).not.toBe(second);
    expect(await compare("Admin123!", first)).toBe(true);
    expect(await compare("Admin123!", second)).toBe(true);
  }, 20_000);
});

describe("loginSchema", () => {
  it("normalises the email", () => {
    const result = loginSchema.parse({ email: "  Admin@PetShop.Local ", password: "x" });
    expect(result.email).toBe("admin@petshop.local");
  });

  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "admin@petshop.local", password: "" }).success).toBe(
      false,
    );
  });
});
