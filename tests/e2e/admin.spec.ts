import { expect, test } from "@playwright/test";

import {
  ADMIN,
  CATEGORY_NAME,
  PRODUCT_NAME,
  SKU_PREFIX,
  loginAs,
  productIdFromUrl,
  removeE2EFixtures,
  selectOption,
} from "./support/fixtures";

// Registered at file scope: the fixtures must go even when a step in the middle fails.
test.afterAll(() => {
  removeE2EFixtures();
});

/**
 * Spec section 10: Admin logs in, creates a category and a product, takes stock in, places an
 * order and walks it through every status up to DELIVERED.
 */
test("Admin: категорія, товар, прихід, замовлення і прохід статусів до DELIVERED", async ({
  page,
}) => {
  await loginAs(page, ADMIN);

  await page.goto("/categories");
  // Every row has its own rename input with the same placeholder, so the add form is addressed
  // by its id (`category-new`) instead of by the shared placeholder.
  await page.locator("#category-new").fill(CATEGORY_NAME);
  await page.getByRole("button", { name: "Додати", exact: true }).click();
  await expect(page.getByRole("cell", { name: CATEGORY_NAME, exact: true })).toBeVisible();

  await page.goto("/products/new");
  await page.getByLabel("SKU").fill(`${SKU_PREFIX}-1`);
  await page.getByLabel("Назва", { exact: true }).fill(PRODUCT_NAME);
  await page.getByLabel("Ціна, грн").fill("199.50");
  await selectOption(page.getByLabel("Категорія"), { label: CATEGORY_NAME });
  await page.getByLabel("Поріг малого залишку").fill("3");
  await page.getByRole("button", { name: "Створити товар" }).click();

  // `/products/new` matches `[^/]+` as well, so the form route has to be excluded explicitly.
  await page.waitForURL(/\/products\/(?!new$)[^/]+$/);
  const productId = productIdFromUrl(page.url());
  expect(productId).not.toBe("");
  await expect(page.getByRole("heading", { name: PRODUCT_NAME })).toBeVisible();

  // A new product starts empty, so the order below can only pass after the stock arrives.
  // The page carries the movement form and the journal filter, both with a "Товар" select,
  // so they are addressed by id: `#stockProductId` and `#productId`.
  await page.goto("/stock");
  await selectOption(page.locator("#stockProductId"), { value: productId });
  await page.getByLabel("Кількість (+ прихід, − списання)").fill("10");
  await selectOption(page.locator("#stockReason"), { label: "Прихід на склад" });
  await page.getByLabel("Нотатка").fill("E2E: тестовий прихід");
  await page.getByRole("button", { name: "Записати рух" }).click();
  await expect(page.getByText("E2E: тестовий прихід")).toBeVisible();
  await expect(page.getByRole("cell", { name: "10", exact: true }).first()).toBeVisible();

  await page.goto("/orders/new");
  await selectOption(page.getByLabel("Клієнт"), { label: "Олена Ковальчук · +380501234567" });
  await selectOption(page.getByLabel("Товар 1"), { value: productId });
  await page.getByLabel("Кількість 1").fill("2");
  await page.getByRole("button", { name: "Створити замовлення" }).click();

  // `/orders/new` matches `[^/]+` as well, so the form route has to be excluded explicitly.
  await page.waitForURL(/\/orders\/(?!new$)[^/]+$/);
  await expect(page.getByRole("heading", { name: /Замовлення №\d+/ })).toBeVisible();

  const heading = await page.getByRole("heading", { name: /Замовлення №\d+/ }).textContent();
  const orderNumber = heading?.match(/№(\d+)/)?.[1] ?? "";
  expect(orderNumber).not.toBe("");
  await expect(page.getByText("Нове", { exact: true }).first()).toBeVisible();

  for (const status of ["Підтверджено", "Відправлено", "Доставлено"]) {
    await page.getByRole("button", { name: status, exact: true }).click();
    await expect(page.getByRole("button", { name: status, exact: true })).toHaveCount(0);
  }

  await expect(page.getByText("Доставлено", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Замовлення у фінальному статусі.")).toBeVisible();

  // Every step of the walk is in the history, oldest first. The creation entry has no
  // "from" status, so only the three transitions carry an arrow.
  const history = page.getByRole("listitem").filter({ hasText: "→" });
  await expect(history).toHaveCount(3);
  await expect(history.first()).toContainText("Нове → Підтверджено");
  await expect(history.last()).toContainText("Відправлено → Доставлено");

  // A delivered order is no longer open, so it drops off the dashboard.
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: new RegExp(`№${orderNumber}\\b`) })).toHaveCount(0);

  // The stock was reduced once, by the order, and nothing else moved it.
  await page.goto(`/products/${productId}`);
  const stockCard = page.locator("div", { has: page.getByText("Залишок", { exact: true }) }).last();
  await expect(stockCard).toContainText("8");

  await page.goto("/stock");
  await selectOption(page.locator("#reason"), { label: "Списання на замовлення" });
  await selectOption(page.locator("#productId"), { value: productId });
  const journalRow = page.getByRole("row").filter({ hasText: `№${orderNumber}` });
  await expect(journalRow).toHaveCount(1);
  await expect(journalRow).toContainText("-2");
});
