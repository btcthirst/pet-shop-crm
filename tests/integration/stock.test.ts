import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCategory } from "@/features/categories/service";
import { createProduct } from "@/features/products/service";
import { createStockMovement, listStockMovements } from "@/features/stock/service";
import { toStockMovementInput } from "@/features/stock/schema";
import { db } from "@/lib/db";
import type { AppError } from "@/lib/errors";

import { ensureTestAuthor } from "./support/author";

const tag = Date.now().toString(36);
let adminId = "";
let createdAdmin = false;
let productId = "";
let emptyProductId = "";

beforeAll(async () => {
  const author = await ensureTestAuthor(`stock-test-${tag}`);
  adminId = author.id;
  createdAdmin = author.created;

  const category = await createCategory({ name: `Склад-${tag}` });
  const product = await createProduct({
    sku: `STK-${tag}`,
    name: "Тест-товар для складу",
    priceKopecks: 1000,
    categoryId: category.id,
    lowStockThreshold: 2,
  });
  productId = product.id;

  const empty = await createProduct({
    sku: `STK-EMPTY-${tag}`,
    name: "Тест-товар без залишку",
    priceKopecks: 1000,
    categoryId: category.id,
    lowStockThreshold: 2,
  });
  emptyProductId = empty.id;
});

afterAll(async () => {
  const ids = [productId, emptyProductId].filter(Boolean);
  await db.stockMovement.deleteMany({ where: { productId: { in: ids } } });
  await db.product.deleteMany({ where: { id: { in: ids } } });
  await db.category.deleteMany({ where: { name: { startsWith: "Склад-" } } });
  if (createdAdmin) await db.user.deleteMany({ where: { id: adminId } });
  await db.$disconnect();
});

const stockOf = async (id: string) =>
  (await db.product.findUniqueOrThrow({ where: { id }, select: { stock: true } })).stock;

const bookedOf = async (id: string) =>
  (await db.stockMovement.aggregate({ where: { productId: id }, _sum: { delta: true } }))._sum
    .delta ?? 0;

describe("рухи залишків", () => {
  it("прихід збільшує залишок і пише рух із причиною RESTOCK", async () => {
    const result = await createStockMovement(
      { productId, delta: 10, reason: "RESTOCK", note: "Постачальник" },
      adminId,
    );

    expect(result.movement.delta).toBe(10);
    expect(result.movement.reason).toBe("RESTOCK");
    expect(await stockOf(productId)).toBe(10);
    expect(await bookedOf(productId)).toBe(10);
  });

  it("коригування може бути від'ємним і лишає баланс у рівновазі", async () => {
    await createStockMovement(
      { productId, delta: -3, reason: "CORRECTION", note: "Перерахунок" },
      adminId,
    );

    expect(await stockOf(productId)).toBe(7);
    expect(await bookedOf(productId)).toBe(7);
  });

  it("не списує більше, ніж є на складі", async () => {
    await expect(
      createStockMovement({ productId, delta: -8, reason: "CORRECTION" }, adminId),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

    // Nothing moved: neither the stock nor the journal.
    expect(await stockOf(productId)).toBe(7);
    expect(await bookedOf(productId)).toBe(7);
  });

  it("не знаходить невідомий товар", async () => {
    await expect(
      createStockMovement({ productId: "no-such-product", delta: 1, reason: "RESTOCK" }, adminId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("схема не пропускає нуль і від'ємний прихід", async () => {
    // The service takes a typed payload, so these rules live in the schema the action uses.
    expect(() =>
      toStockMovementInput({ productId, delta: "0", reason: "RESTOCK", note: "" }),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));

    expect(() =>
      toStockMovementInput({ productId, delta: "-2", reason: "RESTOCK", note: "" }),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("повертає залишки разом із рухом", async () => {
    const result = await createStockMovement(
      { productId: emptyProductId, delta: 4, reason: "RESTOCK" },
      adminId,
    );

    expect(result.stockBefore).toBe(0);
    expect(result.stockAfter).toBe(4);
    expect(result.movement.productId).toBe(emptyProductId);
  });

  it("фільтрує журнал за товаром і причиною та рахує сторінки", async () => {
    const byProduct = await listStockMovements({ page: 1, pageSize: 20, productId });
    expect(byProduct.items.every((item) => item.productId === productId)).toBe(true);

    const restock = await listStockMovements({
      page: 1,
      pageSize: 20,
      productId,
      reason: "RESTOCK",
    });
    expect(restock.items.every((item) => item.reason === "RESTOCK")).toBe(true);

    const correction = await listStockMovements({
      page: 1,
      pageSize: 20,
      productId,
      reason: "CORRECTION",
    });
    expect(correction.items.every((item) => item.reason === "CORRECTION")).toBe(true);

    const paged = await listStockMovements({ page: 1, pageSize: 1 });
    expect(paged.items).toHaveLength(1);
    expect(paged.total).toBeGreaterThan(1);
    expect(paged.totalPages).toBe(Math.ceil(paged.total / 1));
  });

  it("повертає рух разом із залишком до і після", async () => {
    const result = await createStockMovement({ productId, delta: 1, reason: "RESTOCK" }, adminId);

    expect(result.stockBefore).toBe(7);
    expect(result.stockAfter).toBe(8);
    expect(result.movement.productName).toBe("Тест-товар для складу");
    expect(result.movement.productSku).toBe(`STK-${tag}`);
    expect(result.movement.createdByName).toBeTruthy();
  });
});

describe("помилки рухів", () => {
  it("повертає помилку як AppError з кодом і статусом", async () => {
    const error = (await createStockMovement(
      { productId, delta: -100, reason: "CORRECTION" },
      adminId,
    ).catch((cause) => cause)) as AppError;

    expect(error.code).toBe("INSUFFICIENT_STOCK");
    expect(error.status).toBe(409);
  });
});
