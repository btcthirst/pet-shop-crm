import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createOrder, changeOrderStatus } from "@/features/orders/service";
import { createStockMovement } from "@/features/stock/service";
import { db } from "@/lib/db";
import { isAppError } from "@/lib/errors";

import type { OrderStatus } from "@/generated/prisma/enums";

/**
 * Integration tests of spec section 10. They run against the dev database (Neon branch)
 * inside a dedicated category and customer, and remove everything they create.
 */

const runId = randomUUID().slice(0, 8);

let categoryId = "";
let customerId = "";
let authorId = "";
let createdAuthor = false;

async function createProduct(sku: string, stock: number): Promise<string> {
  const product = await db.product.create({
    data: {
      sku,
      name: `Тестовий товар ${sku}`,
      priceKopecks: 19900,
      lowStockThreshold: 1,
      categoryId,
      stock: 0,
    },
    select: { id: true },
  });

  if (stock > 0) {
    // Going through the stock service keeps the `sum(delta) === stock` invariant true.
    await createStockMovement(
      { productId: product.id, delta: stock, reason: "RESTOCK", note: "integration fixture" },
      authorId,
    );
  }

  return product.id;
}

async function stockOf(productId: string): Promise<number> {
  const product = await db.product.findUniqueOrThrow({
    where: { id: productId },
    select: { stock: true },
  });
  return product.stock;
}

async function movementsOf(productId: string) {
  return db.stockMovement.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
    select: { delta: true, reason: true, orderId: true },
  });
}

beforeAll(async () => {
  // The author is created here so the suite does not depend on `pnpm db:seed` (CI only runs
  // migrations). Nothing signs in with this account, so the hash is never checked.
  const existing = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });

  if (existing) {
    authorId = existing.id;
  } else {
    const author = await db.user.create({
      data: {
        email: `orders-test-${runId}@petshop.local`,
        name: "Тестовий Admin",
        role: "ADMIN",
        passwordHash: "not-used",
      },
      select: { id: true },
    });
    authorId = author.id;
    createdAuthor = true;
  }

  const category = await db.category.create({
    data: { name: `Тест-замовлення ${runId}`, slug: `test-orders-${runId}` },
    select: { id: true },
  });
  categoryId = category.id;

  const customer = await db.customer.create({
    data: { name: "Тестовий клієнт", phone: `+380991${runId.replace(/\D/g, "").padEnd(4, "0")}` },
    select: { id: true },
  });
  customerId = customer.id;
});

afterAll(async () => {
  if (customerId) await db.order.deleteMany({ where: { customerId } });
  if (categoryId) {
    await db.stockMovement.deleteMany({ where: { product: { categoryId } } });
    await db.product.deleteMany({ where: { categoryId } });
    await db.category.deleteMany({ where: { id: categoryId } });
  }
  if (customerId) await db.customer.deleteMany({ where: { id: customerId } });
  if (createdAuthor) await db.user.deleteMany({ where: { id: authorId } });
  await db.$disconnect();
});

describe("order creation writes stock movements in the same transaction", () => {
  it("decrements stock, records ORDER movements and copies prices", async () => {
    const productId = await createProduct(`TST-ORD-${runId}-A`, 5);
    const secondId = await createProduct(`TST-ORD-${runId}-B`, 3);

    const order = await createOrder(
      {
        customerId,
        items: [
          { productId, quantity: 2 },
          { productId: secondId, quantity: 1 },
        ],
        comment: "інтеграційний тест",
      },
      authorId,
    );

    expect(order.status).toBe("NEW");
    expect(order.totalKopecks).toBe(2 * 19900 + 19900);
    expect(order.items.map((item) => item.unitPriceKopecks)).toEqual([19900, 19900]);
    expect(await stockOf(productId)).toBe(3);
    expect(await stockOf(secondId)).toBe(2);

    const movements = await movementsOf(productId);
    expect(movements).toHaveLength(2);
    expect(movements[1]).toMatchObject({ delta: -2, reason: "ORDER", orderId: order.id });

    // A new order opens its history with a creation entry.
    expect(order.history).toEqual([
      expect.objectContaining({
        fromStatus: null,
        toStatus: "NEW",
        changedByName: expect.any(String),
      }),
    ]);
  });

  it("fails with INSUFFICIENT_STOCK and changes nothing", async () => {
    const productId = await createProduct(`TST-ORD-${runId}-C`, 2);
    const before = await movementsOf(productId);
    const orderCountBefore = await db.order.count({ where: { customerId } });

    const attempt = createOrder({ customerId, items: [{ productId, quantity: 5 }] }, authorId);

    await expect(attempt).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", status: 409 });
    expect(await stockOf(productId)).toBe(2);
    expect(await movementsOf(productId)).toEqual(before);
    expect(await db.order.count({ where: { customerId } })).toBe(orderCountBefore);
  });

  it("rejects an unknown customer and an unknown product", async () => {
    const productId = await createProduct(`TST-ORD-${runId}-D`, 1);

    await expect(
      createOrder({ customerId: "cus_missing", items: [{ productId, quantity: 1 }] }, authorId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      createOrder({ customerId, items: [{ productId: "prd_missing", quantity: 1 }] }, authorId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(await stockOf(productId)).toBe(1);
  });

  it("does not offer deactivated products", async () => {
    const productId = await createProduct(`TST-ORD-${runId}-E`, 2);
    await db.product.update({ where: { id: productId }, data: { isActive: false } });

    await expect(
      createOrder({ customerId, items: [{ productId, quantity: 1 }] }, authorId),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(await stockOf(productId)).toBe(2);
  });

  it("lets exactly one of two parallel orders take the last unit", async () => {
    const productId = await createProduct(`TST-ORD-${runId}-F`, 1);

    const results = await Promise.allSettled([
      createOrder({ customerId, items: [{ productId, quantity: 1 }] }, authorId),
      createOrder({ customerId, items: [{ productId, quantity: 1 }] }, authorId),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0]?.status === "rejected") {
      expect(isAppError(rejected[0].reason) && rejected[0].reason.code).toBe("INSUFFICIENT_STOCK");
    }

    expect(await stockOf(productId)).toBe(0);
    expect(await db.order.count({ where: { items: { some: { productId } } } })).toBe(1);
  });
});

describe("status transitions", () => {
  it("returns stock and writes CANCEL movements when cancelling", async () => {
    const productId = await createProduct(`TST-ORD-${runId}-G`, 4);
    const order = await createOrder({ customerId, items: [{ productId, quantity: 3 }] }, authorId);
    expect(await stockOf(productId)).toBe(1);

    const cancelled = await changeOrderStatus(order.id, "CANCELLED", authorId);

    expect(cancelled.status).toBe("CANCELLED");
    expect(await stockOf(productId)).toBe(4);

    const movements = await movementsOf(productId);
    expect(movements.map((movement) => [movement.reason, movement.delta])).toEqual([
      ["RESTOCK", 4],
      ["ORDER", -3],
      ["CANCEL", 3],
    ]);
    expect(cancelled.history.at(-1)).toMatchObject({ fromStatus: "NEW", toStatus: "CANCELLED" });
  });

  it("walks NEW to DELIVERED and refuses every forbidden move", async () => {
    const productId = await createProduct(`TST-ORD-${runId}-H`, 2);
    const order = await createOrder({ customerId, items: [{ productId, quantity: 1 }] }, authorId);

    const path: OrderStatus[] = ["CONFIRMED", "SHIPPED", "DELIVERED"];
    let current = order;

    for (const toStatus of path) {
      current = await changeOrderStatus(order.id, toStatus, authorId);
      expect(current.status).toBe(toStatus);
    }

    expect(current.history.map((entry) => entry.toStatus)).toEqual([
      "NEW",
      "CONFIRMED",
      "SHIPPED",
      "DELIVERED",
    ]);

    await expect(changeOrderStatus(order.id, "CANCELLED", authorId)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
      status: 409,
    });
    await expect(changeOrderStatus(order.id, "SHIPPED", authorId)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });

    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      "DELIVERED",
    );
  });

  it("reports an unknown order", async () => {
    await expect(changeOrderStatus("ord_missing", "CONFIRMED", authorId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("stock journal invariant", () => {
  it("keeps sum(delta) equal to stock for every product it touched", async () => {
    const products = await db.product.findMany({
      where: { categoryId },
      select: {
        id: true,
        sku: true,
        stock: true,
        movements: { select: { delta: true } },
      },
    });

    expect(products.length).toBeGreaterThan(0);

    for (const product of products) {
      const sum = product.movements.reduce((total, movement) => total + movement.delta, 0);
      expect(sum, `product ${product.sku}`).toBe(product.stock);
    }
  });
});

describe("role gate on the product route", () => {
  it("answers 403 when a Manager tries to change a price", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth", () => ({
      auth: async () => ({
        user: {
          id: "usr_manager",
          email: "manager@petshop.local",
          name: "Менеджер",
          role: "MANAGER",
        },
      }),
    }));

    const { PATCH } = await import("@/app/api/products/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/products/prd_x", {
        method: "PATCH",
        body: JSON.stringify({ priceKopecks: 1000 }),
      }),
      { params: Promise.resolve({ id: "prd_x" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });

    vi.doUnmock("@/lib/auth");
    vi.resetModules();
  });
});
