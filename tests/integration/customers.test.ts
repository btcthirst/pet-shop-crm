import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCategory } from "@/features/categories/service";
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
} from "@/features/customers/service";
import { createOrder } from "@/features/orders/service";
import { createProduct } from "@/features/products/service";
import { createStockMovement } from "@/features/stock/service";
import { db } from "@/lib/db";

const tag = Date.now().toString(36).slice(-6);
const NAME_PREFIX = `Тест-Клієнт-${tag}`;
const customerIds: string[] = [];
let phoneCounter = 0;

/**
 * The service stores the phone as it arrives: normalisation and validation belong to the schema
 * (`customerInputSchema`, covered by `tests/unit/customers.test.ts`), so the fixtures here are
 * already in E.164 form. The digits differ on every run, so a row left behind by an interrupted
 * run cannot collide with the fixture phone.
 */
function nextPhone() {
  phoneCounter += 1;
  return `+380${String(Number.parseInt(tag, 36) % 10 ** 7).padStart(7, "0")}${phoneCounter}`;
}

async function makeCustomer(overrides: Partial<Parameters<typeof createCustomer>[0]> = {}) {
  const customer = await createCustomer({
    name: `${NAME_PREFIX} ${customerIds.length}`,
    phone: nextPhone(),
    ...overrides,
  });
  customerIds.push(customer.id);
  return customer;
}

const orderIds: string[] = [];
const productIds: string[] = [];
const categoryIds: string[] = [];

beforeAll(async () => {
  // An interrupted run may have left a fixture phone behind, and the phone is unique.
  await db.customer.deleteMany({ where: { phone: "+380501112299" } });
});

afterAll(async () => {
  // Orders go first, and not only the ones this run created: an interrupted run may have left a
  // test customer with an order behind, and the customer cannot be deleted while it exists.
  const strayOrders = await db.order.findMany({
    where: { customer: { name: { startsWith: "Тест-Клієнт-" } } },
    select: { id: true },
  });
  const strayOrderIds = [...new Set([...orderIds, ...strayOrders.map((order) => order.id)])];

  await db.stockMovement.deleteMany({ where: { orderId: { in: strayOrderIds } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: strayOrderIds } } });
  await db.orderStatusHistory.deleteMany({ where: { orderId: { in: strayOrderIds } } });
  await db.order.deleteMany({ where: { id: { in: strayOrderIds } } });

  await db.customer.deleteMany({ where: { id: { in: customerIds } } });
  await db.customer.deleteMany({ where: { name: { startsWith: "Тест-Клієнт-" } } });

  // The stray products are matched by SKU as well, so a product from an interrupted run loses
  // its journal before it is removed.
  const strayProducts = await db.product.findMany({
    where: { sku: { startsWith: "CUST-ORD-" } },
    select: { id: true },
  });
  const allProductIds = [...productIds, ...strayProducts.map((product) => product.id)];

  await db.stockMovement.deleteMany({ where: { productId: { in: allProductIds } } });
  await db.product.deleteMany({ where: { id: { in: allProductIds } } });
  await db.category.deleteMany({ where: { id: { in: categoryIds } } });
  await db.category.deleteMany({ where: { name: { startsWith: `Замовлення-${tag}` } } });

  await db.$disconnect();
});

describe("клієнти", () => {
  it("зберігає ім’я, телефон і нотатки як їх передали", async () => {
    const phone = nextPhone();
    const customer = await makeCustomer({
      phone,
      name: `${NAME_PREFIX} Олена Ковальчук`,
      notes: "Постійний клієнт",
    });

    expect(customer.phone).toBe(phone);
    expect(customer.name).toBe(`${NAME_PREFIX} Олена Ковальчук`);
    expect(customer.notes).toBe("Постійний клієнт");
  });

  it("відмовляє дубль телефону", async () => {
    const first = await makeCustomer();

    await expect(makeCustomer({ phone: first.phone })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("оновлює поля і не змінює решту", async () => {
    const customer = await makeCustomer({ email: "old@example.com" });

    const updated = await updateCustomer(customer.id, { email: "new@example.com", notes: null });

    expect(updated.email).toBe("new@example.com");
    expect(updated.notes).toBeNull();
    expect(updated.phone).toBe(customer.phone);
  });

  it("видаляє клієнта без замовлень", async () => {
    const customer = await makeCustomer();
    customerIds.splice(customerIds.indexOf(customer.id), 1);

    await expect(deleteCustomer(customer.id)).resolves.toBeUndefined();
    await expect(getCustomer(customer.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("оновлює одне поле й звітує про відсутнього клієнта", async () => {
    const customer = await makeCustomer({ notes: "нотатка" });

    // A patch with a single field leaves every other column out of the UPDATE statement.
    const updated = await updateCustomer(customer.id, { email: "single@example.com" });
    expect(updated.email).toBe("single@example.com");
    expect(updated.name).toBe(customer.name);
    expect(updated.notes).toBe("нотатка");

    await expect(
      updateCustomer("no-such-customer", { email: "x@example.com" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteCustomer("no-such-customer")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("не видаляє клієнта, поки в нього є замовлення", async () => {
    const customer = await makeCustomer();

    const adminId = (await db.user.findUniqueOrThrow({ where: { email: "admin@petshop.local" } }))
      .id;
    const category = await createCategory({ name: `Замовлення-${tag}` });
    categoryIds.push(category.id);
    const product = await createProduct({
      sku: `CUST-ORD-${tag}`,
      name: "Товар для замовлення клієнта",
      priceKopecks: 1500,
      categoryId: category.id,
      lowStockThreshold: 1,
    });
    productIds.push(product.id);
    await createStockMovement({ productId: product.id, delta: 5, reason: "RESTOCK" }, adminId);

    const order = await createOrder(
      { customerId: customer.id, items: [{ productId: product.id, quantity: 1 }], comment: null },
      adminId,
    );
    orderIds.push(order.id);

    await expect(deleteCustomer(customer.id)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("замовлення"),
    });

    // The customer is still readable and now has the order on their card.
    const card = await getCustomer(customer.id);
    expect(card.id).toBe(customer.id);
    expect(card.orders.map((entry) => entry.id)).toEqual([order.id]);
  });

  it("шукає за ім’ям і телефоном і рахує сторінки", async () => {
    const customer = await makeCustomer({ name: `${NAME_PREFIX} унікальний` });

    const byName = await listCustomers({ page: 1, pageSize: 20, q: `${NAME_PREFIX} унікальний` });
    expect(byName.items.map((item) => item.id)).toContain(customer.id);

    const byPhone = await listCustomers({ page: 1, pageSize: 20, q: customer.phone.slice(3) });
    expect(byPhone.items.map((item) => item.id)).toContain(customer.id);

    const first = await listCustomers({ page: 1, pageSize: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.totalPages).toBe(Math.ceil(first.total / 2));
  });

  it("повертає картку з порожньою історією замовлень", async () => {
    const customer = await makeCustomer();

    const card = await getCustomer(customer.id);

    expect(card.id).toBe(customer.id);
    expect(card.orders).toEqual([]);
    expect(card.createdAt).toBeInstanceOf(Date);
  });
});
