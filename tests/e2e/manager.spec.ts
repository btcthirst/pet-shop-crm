import { expect, test } from "@playwright/test";

import { MANAGER, loginAs } from "./support/fixtures";

/**
 * Spec section 10: a Manager must not see the Users section and must not get the price form.
 * The API answers 403 as well, but that is covered by `tests/integration/orders.test.ts`; here
 * the UI must not even offer the action.
 */
test("Manager: немає розділу Користувачі та кнопки зміни ціни", async ({ page }) => {
  await loginAs(page, MANAGER);

  await expect(page.getByRole("link", { name: "Товари", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Користувачі", exact: true })).toHaveCount(0);

  // Even a hand-typed URL lands on the access-denied page instead of the user list.
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Доступ заборонено" })).toBeVisible();
  await expect(page.getByText("Користувачі", { exact: true })).toHaveCount(0);

  await page.goto("/products");
  await page.getByRole("row").nth(1).getByRole("link").first().click();
  await page.waitForURL(/\/products\/[^/]+$/);

  // The price is readable, but there is no form to change it.
  await expect(page.getByText("Ціна", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Ціна, грн")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Зберегти зміни" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Змінити ціну" })).toHaveCount(0);
});
