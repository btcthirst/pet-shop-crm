import "dotenv/config";

import { db } from "../../../src/lib/db";

/**
 * E2E fixtures are removed from here rather than from the Playwright process: the generated
 * Prisma client is ESM and Playwright's CommonJS transform cannot load it, while `tsx` runs this
 * script exactly like the seed and the Vitest suites do.
 *
 * Usage: tsx tests/e2e/support/cleanup.ts <sku-prefix> <category-name-prefix>
 */
async function main() {
  const prefix = process.argv[2];
  const categoryPrefix = process.argv[3] ?? "";

  if (!prefix) {
    console.error("Вкажіть префікс SKU, який треба прибрати.");
    process.exit(1);
  }

  const products = await db.product.findMany({
    where: { sku: { startsWith: prefix } },
    select: { id: true, categoryId: true },
  });

  if (products.length > 0) {
    const productIds = products.map((product) => product.id);
    const orders = await db.order.findMany({
      where: { items: { some: { productId: { in: productIds } } } },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);

    await db.$transaction([
      db.stockMovement.deleteMany({ where: { orderId: { in: orderIds } } }),
      db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
      db.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } }),
      db.order.deleteMany({ where: { id: { in: orderIds } } }),
      // The products take their own journal with them, so no balance can be left behind.
      db.stockMovement.deleteMany({ where: { productId: { in: productIds } } }),
      db.product.deleteMany({ where: { id: { in: productIds } } }),
    ]);

    console.log(`Прибрано: товарів ${products.length}, замовлень ${orderIds.length}.`);
  } else {
    console.log("E2E-товарів не знайдено.");
  }

  // Categories of the previous runs may be left empty by an interrupted test, so they are
  // matched by name as well and only removed while no product refers to them.
  if (categoryPrefix) {
    const { count } = await db.category.deleteMany({
      where: { name: { startsWith: categoryPrefix }, products: { none: {} } },
    });
    if (count > 0) console.log(`Прибрано: категорій ${count}.`);
  }

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
