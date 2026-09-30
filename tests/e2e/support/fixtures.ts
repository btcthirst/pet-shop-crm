import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

export const ADMIN = { email: "admin@petshop.local", password: "Admin123!" };
export const MANAGER = { email: "manager@petshop.local", password: "Manager123!" };

/**
 * E2E tests write to the dev database and remove their own artefacts afterwards, so the suite can
 * be run repeatedly against the demo data without leaving anything behind.
 */
export const RUN_TAG = `${Date.now().toString(36)}-${process.pid}`;
export const SKU_PREFIX = `E2E-${RUN_TAG}`;
export const CATEGORY_PREFIX = "E2E-категорія";
export const CATEGORY_NAME = `${CATEGORY_PREFIX} ${RUN_TAG}`;
export const PRODUCT_NAME = `E2E-товар ${RUN_TAG}`;

export async function loginAs(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Пароль").fill(user.password);
  await page.getByRole("button", { name: "Увійти" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/**
 * Next.js renders a form on the server and hydrates it a moment later. A `<select>` chosen
 * before hydration is reset to its first option when React takes over the DOM, which looks like
 * a silently ignored choice. The selection is therefore repeated until it sticks.
 */
export async function selectOption(
  locator: Locator,
  option: { label: string } | { value: string } | { index: number },
) {
  await expect(async () => {
    await locator.selectOption(option);
    await expect(locator).not.toHaveValue("");
  }).toPass({ timeout: 10_000 });
}

/** The id out of `/products/<id>`, needed for the `<select>`s that are addressed by value. */
export function productIdFromUrl(url: string) {
  return url.split("?")[0].split("/").pop() ?? "";
}

/**
 * Runs the fixture cleanup in a child process: see the comment in `cleanup.ts` for why the
 * generated Prisma client cannot be imported into the Playwright runner.
 */
export function removeE2EFixtures() {
  // `__dirname` rather than `import.meta.url`: Playwright transpiles the suite to CommonJS.
  const script = join(__dirname, "cleanup.ts");
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", script, SKU_PREFIX, CATEGORY_PREFIX],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.status !== 0) {
    throw new Error(`Не вдалося прибрати E2E-дані (exit ${result.status}).`);
  }
}
