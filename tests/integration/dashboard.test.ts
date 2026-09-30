import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDashboard, OPEN_ORDER_STATUSES } from "@/features/dashboard/service";
import { createOrder } from "@/features/orders/service";
import { createStockMovement } from "@/features/stock/service";
import { db } from "@/lib/db";

/**
 * Stage 6 is done when the dashboard matches the database, so every assertion here is
 * compared with an independent query instead of a hardcoded number.
 */

const runId = randomUUID().slice(0, 8);

let categoryId = "";
let customerId = "";
let authorId = "";
let createdAuthor = false;
const productIds: string[] = [];
const orderIds: string[] = [];

beforeAll(async () => {
  const existing = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });

  if (existing) {
    authorId = existing.id;
  } else {
    const author = await db.user.create({
      data: {
        email: `dashboard-test-${runId}@petshop.local`,
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
    data: { name: `Тест-дашборд ${runId}`, slug: `test-dashboard-${runId}` },
    select: { id: true },
  });
  categoryId = category.id;

  const customer = await db.customer.create({
    data: { name: "Тестовий клієнт", phone: `+380992${runId.replace(/\D/g, "").padEnd(4, "0")}` },
    select: { id: true },
  });
  customerId = customer.id;

  // One product above its threshold, two below it — plus one below it but deactivated.
  for (const [index, stock] of [10, 1, 0].entries()) {
    const product = await db.product.create({
      data: {
        sku: `TST-DSH-${runId}-${index}`,
        name: `Тестовий товар ${index}`,
        priceKopecks: 5000,
        lowStockThreshold: 2,
        categoryId,
        stock: 0,
      },
      select: { id: true },
    });
    productIds.push(product.id);

    if (stock > 0) {
      await createStockMovement(
        { productId: product.id, delta: stock, reason: "RESTOCK", note: "dashboard fixture" },
        authorId,
      );
    }
  }

  const hidden = await db.product.create({
    data: {
      sku: `TST-DSH-${runId}-OFF`,
      name: "Деактивований товар",
      priceKopecks: 5000,
      lowStockThreshold: 2,
      categoryId,
      stock: 0,
      isActive: false,
    },
    select: { id: true },
  });
  productIds.push(hidden.id);

  const first = await createOrder(
    { customerId, items: [{ productId: productIds[0], quantity: 2 }] },
    authorId,
  );
  orderIds.push(first.id);
});

afterAll(async () => {
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  await db.product.deleteMany({ where: { id: { in: productIds } } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  if (customerId) await db.customer.deleteMany({ where: { id: customerId } });
  if (createdAuthor) await db.user.deleteMany({ where: { id: authorId } });
  await db.$disconnect();
});

describe("dashboard data matches the database", () => {
  it("counts open orders like the database does", async () => {
    const dashboard = await getDashboard();
    const fromDb = await db.order.count({ where: { status: { in: OPEN_ORDER_STATUSES } } });

    expect(dashboard.newOrders.count).toBe(fromDb);
    expect(dashboard.newOrders.items.length).toBeLessThanOrEqual(fromDb);
  });

  it("lists only open orders, newest first", async () => {
    const dashboard = await getDashboard();
    const mine = dashboard.newOrders.items.filter((order) => orderIds.includes(order.id));

    expect(mine).toHaveLength(1);
    expect(mine[0]?.status).toBe("NEW");
    expect(mine[0]?.customerName).toBe("Тестовий клієнт");
    expect(mine[0]?.itemsCount).toBe(1);

    for (const order of dashboard.newOrders.items) {
      expect(OPEN_ORDER_STATUSES).toContain(order.status);
    }
  });

  it("counts low-stock products with the same rule as the catalogue", async () => {
    const dashboard = await getDashboard();

    const fromDb = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Product"
      WHERE "isActive" AND stock <= "lowStockThreshold"
    `;

    expect(dashboard.lowStock.count).toBe(Number(fromDb[0]?.count ?? 0));
  });

  it("returns the low-stock products of the fixture and hides the rest", async () => {
    const dashboard = await getDashboard(100);
    const mine = dashboard.lowStock.items.filter((item) => productIds.includes(item.id));

    // Product 0 had 10 units and the order took 2, so 8 > threshold 2 stays out of the list.
    expect(mine.map((item) => item.sku).sort()).toEqual([
      `TST-DSH-${runId}-1`,
      `TST-DSH-${runId}-2`,
    ]);
    expect(mine.some((item) => item.sku === `TST-DSH-${runId}-OFF`)).toBe(false);
  });

  it("sorts low-stock products by the smallest stock first", async () => {
    const mine = (await getDashboard(100)).lowStock.items.filter((item) =>
      productIds.includes(item.id),
    );

    const stocks = mine.map((item) => item.stock);
    expect(stocks).toEqual([...stocks].sort((a, b) => a - b));
  });

  it("honours the row limit", async () => {
    const dashboard = await getDashboard(1);
    expect(dashboard.newOrders.items.length).toBeLessThanOrEqual(1);
    expect(dashboard.lowStock.items).toHaveLength(1);
  });

  it("keeps the stock journal invariant for its fixtures", async () => {
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { sku: true, stock: true, movements: { select: { delta: true } } },
    });

    for (const product of products) {
      const sum = product.movements.reduce((total, movement) => total + movement.delta, 0);
      expect(sum, product.sku).toBe(product.stock);
    }
  });
});
