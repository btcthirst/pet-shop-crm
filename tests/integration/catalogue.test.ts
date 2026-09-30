import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  listCategories,
  createCategory,
  deleteCategory,
  getCategory,
  updateCategory,
} from "@/features/categories/service";
import {
  createProduct,
  getProduct,
  listProducts,
  setProductActive,
  updateProduct,
} from "@/features/products/service";
import { db } from "@/lib/db";

const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const categoryIds: string[] = [];
const productIds: string[] = [];

async function makeCategory(name: string) {
  const category = await createCategory({ name: `${CATEGORY_PREFIX}${name}` });
  categoryIds.push(category.id);
  return category;
}

async function makeProduct(
  sku: string,
  overrides: Partial<Parameters<typeof createProduct>[0]> = {},
) {
  const category = await makeCategory(sku);
  const product = await createProduct({
    sku,
    name: `Тест-товар ${sku}`,
    priceKopecks: 1000,
    categoryId: category.id,
    lowStockThreshold: 5,
    ...overrides,
  });
  productIds.push(product.id);
  return product;
}

const CATEGORY_PREFIX = "Тест-кате-";
/**
 * Every fixture SKU starts with this prefix, which no seed product uses, so the cleanup below can
 * never reach demo data even when a fixture prefix merely looks similar (`CAT-FOOD-001`).
 */
const SKU_PREFIX = "TST-CAT-";

beforeAll(async () => {
  // An interrupted run can leave a fixture product behind; it would block its category from being
  // deleted, so the leftovers go first.
  const strayProducts = await db.product.findMany({
    where: { sku: { startsWith: SKU_PREFIX } },
    select: { id: true },
  });
  const strayIds = strayProducts.map((product) => product.id);
  await db.stockMovement.deleteMany({ where: { productId: { in: strayIds } } });
  await db.product.deleteMany({ where: { id: { in: strayIds } } });
  await db.category.deleteMany({
    where: { name: { startsWith: CATEGORY_PREFIX }, products: { none: {} } },
  });
});

afterAll(async () => {
  const strayProducts = await db.product.findMany({
    where: { sku: { startsWith: SKU_PREFIX } },
    select: { id: true },
  });
  const allProductIds = [...productIds, ...strayProducts.map((product) => product.id)];

  await db.stockMovement.deleteMany({ where: { productId: { in: allProductIds } } });
  await db.product.deleteMany({ where: { id: { in: allProductIds } } });
  await db.category.deleteMany({ where: { id: { in: categoryIds } } });
  await db.category.deleteMany({
    where: { name: { startsWith: CATEGORY_PREFIX }, products: { none: {} } },
  });
  await db.$disconnect();
});

describe("категорії", () => {
  it("створює категорію з унікальним slug і повертає її у списку", async () => {
    const category = await makeCategory(`Іграшки для тестів ${tag}`);

    // The slug is transliterated and keeps the unique tag, so the demo categories stay apart.
    expect(category.slug).toMatch(/dlia-testiv-/);
    const listed = await listCategories();
    // The list is the place that also counts products per category.
    expect(listed.find((item) => item.id === category.id)?.productsCount).toBe(0);
  });

  it("відмовляє дубль назви категорії", async () => {
    const first = await makeCategory(`Дубль ${tag}`);

    // `makeCategory` adds the fixture prefix, so the second call needs it as well.
    await expect(createCategory({ name: first.name })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("не видаляє категорію, поки в ній є товари", async () => {
    const product = await makeProduct(`TST-DEL-${tag}`);

    await expect(deleteCategory(product.categoryId)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: { productsCount: 1 },
    });

    // Without products the same call succeeds, which proves the guard above was the reason.
    const empty = await makeCategory(`Порожня ${tag}`);
    await expect(deleteCategory(empty.id)).resolves.toBeUndefined();
    expect(categoryIds.splice(categoryIds.indexOf(empty.id), 1)).toHaveLength(1);
  });

  it("читає категорію, перейменовує її разом зі slug і звітує про відсутню", async () => {
    const category = await makeCategory(`Перейменування ${tag}`);

    const found = await getCategory(category.id);
    expect(found.id).toBe(category.id);

    const renamed = await updateCategory(category.id, { name: `Нова назва ${tag}` });
    expect(renamed.name).toBe(`Нова назва ${tag}`);
    // The slug is derived from the name, so a rename has to regenerate it.
    expect(renamed.slug).not.toBe(category.slug);
    expect(renamed.slug).toMatch(/nova-nazva-/);

    await expect(getCategory("no-such-category")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateCategory("no-such-category", { name: "Немає" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteCategory("no-such-category")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("відмовляє назву без коректного slug і дозволяє перейменувати на себе", async () => {
    await expect(createCategory({ name: "!!!" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: { field: "name" },
    });

    const category = await makeCategory(`Сама себе ${tag}`);
    // Renaming a category to its own name must not be read as a duplicate.
    const same = await updateCategory(category.id, { name: category.name });
    expect(same.slug).toBe(category.slug);

    // An empty patch is a read, not a write.
    const untouched = await updateCategory(category.id, {});
    expect(untouched.id).toBe(category.id);

    const other = await makeCategory(`Чужа назва ${tag}`);
    await expect(updateCategory(other.id, { name: category.name })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: { field: "name" },
    });
  });
});

describe("товари", () => {
  it("створює товар без залишку: кожна одиниця має рух у журналі", async () => {
    const product = await makeProduct(`${SKU_PREFIX}NEW-${tag}`, { lowStockThreshold: 3 });

    expect(product.stock).toBe(0);
    expect(product.lowStockThreshold).toBe(3);
    expect(product.isActive).toBe(true);

    const movements = await db.stockMovement.count({ where: { productId: product.id } });
    expect(movements).toBe(0);
  });

  it("відмовляє дубль SKU", async () => {
    await makeProduct(`${SKU_PREFIX}SKU-${tag}`);

    const category = await makeCategory(`Ще одна ${tag}`);
    await expect(
      createProduct({
        sku: `${SKU_PREFIX}SKU-${tag}`,
        name: "Дубль",
        priceKopecks: 100,
        categoryId: category.id,
        lowStockThreshold: 1,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", details: { field: "sku" } });
  });

  it("оновлює ціну й поріг, не зачіпаючи решту полів", async () => {
    const product = await makeProduct(`${SKU_PREFIX}UPD-${tag}`, {
      name: "Стара назва",
      description: "Старий опис",
    });

    const updated = await updateProduct(product.id, { priceKopecks: 2599, lowStockThreshold: 9 });

    expect(updated.priceKopecks).toBe(2599);
    expect(updated.lowStockThreshold).toBe(9);
    expect(updated.name).toBe("Стара назва");
    expect(updated.description).toBe("Старий опис");
  });

  it("деактивує й реактивує товар", async () => {
    const product = await makeProduct(`${SKU_PREFIX}ACT-${tag}`);

    const archived = await setProductActive(product.id, false);
    expect(archived.isActive).toBe(false);

    const back = await setProductActive(product.id, true);
    expect(back.isActive).toBe(true);
  });

  it("фільтрує список за пошуком, категорією та малим залишком", async () => {
    const category = await makeCategory(`Фільтри ${tag}`);
    const wanted = await createProduct({
      sku: `${SKU_PREFIX}FIND-${tag}`,
      name: "Головний корм для котів",
      priceKopecks: 5000,
      categoryId: category.id,
      lowStockThreshold: 5,
    });
    productIds.push(wanted.id);

    await db.product.update({ where: { id: wanted.id }, data: { stock: 2 } });

    const byName = await listProducts({
      page: 1,
      pageSize: 20,
      lowStock: false,
      q: "головний корм",
    });
    expect(byName.items.map((item) => item.id)).toContain(wanted.id);

    const bySku = await listProducts({
      page: 1,
      pageSize: 20,
      lowStock: false,
      q: `${SKU_PREFIX}FIND-${tag}`,
    });
    expect(bySku.items.map((item) => item.id)).toEqual([wanted.id]);

    const byCategory = await listProducts({
      page: 1,
      pageSize: 20,
      lowStock: false,
      categoryId: category.id,
    });
    expect(byCategory.items.map((item) => item.id)).toContain(wanted.id);

    const lowStock = await listProducts({ page: 1, pageSize: 100, lowStock: true });
    expect(lowStock.items.map((item) => item.id)).toContain(wanted.id);
    // 2 <= 5 is the only rule the low-stock filter applies.
    expect(lowStock.items.find((item) => item.id === wanted.id)?.isLowStock).toBe(true);
  });

  it("рахує загальну кількість і сторінки послідовно", async () => {
    const first = await listProducts({ page: 1, pageSize: 2, lowStock: false });
    const second = await listProducts({ page: 2, pageSize: 2, lowStock: false });

    expect(first.items).toHaveLength(2);
    expect(second.items).toHaveLength(2);
    expect(first.total).toBeGreaterThanOrEqual(4);
    expect(first.totalPages).toBe(Math.ceil(first.total / 2));
    expect(first.items[0]?.id).not.toBe(second.items[0]?.id);
  });

  it("читає товар разом із категорією та відмовляє для неіснуючого", async () => {
    const product = await makeProduct(`${SKU_PREFIX}GET-${tag}`);

    const found = await getProduct(product.id);
    expect(found.id).toBe(product.id);
    expect(found.category.name).toBe(product.category.name);

    await expect(getProduct("no-such-product")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("переносить товар в іншу категорію і не відповідає на неіснуючу", async () => {
    const product = await makeProduct(`${SKU_PREFIX}MOVE-${tag}`);
    const target = await makeCategory(`Цільова ${tag}`);

    const moved = await updateProduct(product.id, { categoryId: target.id });
    expect(moved.category.id).toBe(target.id);

    await expect(
      updateProduct(product.id, { categoryId: "no-such-category" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(updateProduct("no-such-product", { priceKopecks: 100 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(setProductActive("no-such-product", false)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
