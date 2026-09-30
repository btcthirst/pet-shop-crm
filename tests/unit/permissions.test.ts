import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Role } from "@/generated/prisma/enums";

const authMock = vi.hoisted(() => ({ auth: vi.fn() }));

vi.mock("@/lib/auth", () => ({ auth: authMock.auth }));

const { PERMISSIONS, can, getCurrentUser, requirePermission, requireRole } =
  await import("@/lib/permissions");

function sessionUser(
  role: Role,
  overrides: Partial<{ id: string; email: string; name: string }> = {},
) {
  return {
    user: {
      id: overrides.id ?? "u1",
      email: overrides.email ?? "user@petshop.local",
      name: overrides.name ?? "User",
      role,
    },
  };
}

describe("role matrix (spec section 3)", () => {
  it("lets both roles view the catalogue, stock, customers and orders", () => {
    for (const permission of [
      "CATALOG_VIEW",
      "STOCK_VIEW",
      "CUSTOMER_VIEW",
      "ORDER_VIEW",
    ] as const) {
      expect(can("ADMIN", permission)).toBe(true);
      expect(can("MANAGER", permission)).toBe(true);
    }
  });

  it("restricts product and category changes to Admin", () => {
    for (const permission of [
      "PRODUCT_WRITE",
      "PRODUCT_PRICE_CHANGE",
      "PRODUCT_DEACTIVATE",
      "CATEGORY_WRITE",
    ] as const) {
      expect(can("ADMIN", permission)).toBe(true);
      expect(can("MANAGER", permission)).toBe(false);
    }
  });

  it("lets both roles restock but reserves corrections for Admin", () => {
    expect(can("ADMIN", "STOCK_RESTOCK")).toBe(true);
    expect(can("MANAGER", "STOCK_RESTOCK")).toBe(true);
    expect(can("ADMIN", "STOCK_CORRECTION")).toBe(true);
    expect(can("MANAGER", "STOCK_CORRECTION")).toBe(false);
  });

  it("lets both roles manage customers but reserves deletion for Admin", () => {
    expect(can("ADMIN", "CUSTOMER_WRITE")).toBe(true);
    expect(can("MANAGER", "CUSTOMER_WRITE")).toBe(true);
    expect(can("ADMIN", "CUSTOMER_DELETE")).toBe(true);
    expect(can("MANAGER", "CUSTOMER_DELETE")).toBe(false);
  });

  it("lets both roles create orders and change their status", () => {
    expect(can("ADMIN", "ORDER_CREATE")).toBe(true);
    expect(can("MANAGER", "ORDER_CREATE")).toBe(true);
    expect(can("ADMIN", "ORDER_STATUS_CHANGE")).toBe(true);
    expect(can("MANAGER", "ORDER_STATUS_CHANGE")).toBe(true);
  });

  it("reserves user management for Admin", () => {
    expect(can("ADMIN", "USER_MANAGE")).toBe(true);
    expect(can("MANAGER", "USER_MANAGE")).toBe(false);
  });

  it("never leaves a permission ungranted", () => {
    for (const [permission, roles] of Object.entries(PERMISSIONS)) {
      expect(roles.length, `${permission} must be granted to at least one role`).toBeGreaterThan(0);
    }
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    authMock.auth.mockReset();
  });

  it("throws UNAUTHORIZED without a session", async () => {
    authMock.auth.mockResolvedValue(null);

    await expect(requireRole("ADMIN", "MANAGER")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("throws FORBIDDEN for a role outside the list", async () => {
    authMock.auth.mockResolvedValue(sessionUser("MANAGER"));

    await expect(requireRole("ADMIN")).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("returns the session user when the role matches", async () => {
    authMock.auth.mockResolvedValue(sessionUser("ADMIN", { name: "Адміністратор" }));

    await expect(requireRole("ADMIN")).resolves.toMatchObject({
      name: "Адміністратор",
      role: "ADMIN",
    });
  });
});

describe("requirePermission", () => {
  beforeEach(() => {
    authMock.auth.mockReset();
  });

  it("rejects a Manager trying to change a price", async () => {
    authMock.auth.mockResolvedValue(sessionUser("MANAGER"));

    await expect(requirePermission("PRODUCT_PRICE_CHANGE")).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("allows a Manager to restock", async () => {
    authMock.auth.mockResolvedValue(sessionUser("MANAGER"));

    await expect(requirePermission("STOCK_RESTOCK")).resolves.toMatchObject({ role: "MANAGER" });
  });
});

describe("getCurrentUser", () => {
  beforeEach(() => {
    authMock.auth.mockReset();
  });

  it("returns null without a session", async () => {
    authMock.auth.mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("maps the session to a SessionUser", async () => {
    authMock.auth.mockResolvedValue(sessionUser("MANAGER", { id: "u42", name: "Менеджер" }));

    await expect(getCurrentUser()).resolves.toEqual({
      id: "u42",
      email: "user@petshop.local",
      name: "Менеджер",
      role: "MANAGER",
    });
  });
});
