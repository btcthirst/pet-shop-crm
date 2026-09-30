import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

import type { OrderStatus } from "../src/generated/prisma/enums";
import type { Role } from "../src/generated/prisma/enums";

import { changeOrderStatus, createOrder } from "../src/features/orders/service";

/** Same resolution order as prisma.config.ts / src/lib/env.ts: dev branch first. */
function createPrismaClient() {
  const connectionString =
    [
      process.env.DIRECT_URL_DEV,
      process.env.DIRECT_URL,
      process.env.DATABASE_URL_DEV,
      process.env.DATABASE_URL,
    ].find((value) => typeof value === "string" && value.length > 0) ?? "";

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const BCRYPT_COST = 12;

type SeedUser = {
  email: string;
  name: string;
  role: Role;
  password: string;
};

const SEED_USERS: SeedUser[] = [
  {
    email: "admin@petshop.local",
    name: "Адміністратор",
    role: "ADMIN",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123!",
  },
  {
    email: "manager@petshop.local",
    name: "Менеджер",
    role: "MANAGER",
    password: process.env.SEED_MANAGER_PASSWORD ?? "Manager123!",
  },
];

const SEED_CATEGORIES = [
  { name: "Корм для собак", slug: "dog-food" },
  { name: "Корм для котів", slug: "cat-food" },
  { name: "Іграшки", slug: "toys" },
  { name: "Аксесуари", slug: "accessories" },
];

type SeedProduct = {
  sku: string;
  name: string;
  description: string;
  priceKopecks: number;
  stock: number;
  lowStockThreshold: number;
  categorySlug: string;
};

const SEED_PRODUCTS: SeedProduct[] = [
  {
    sku: "DOG-FOOD-001",
    name: "Гранули для дорослих собак, 2 кг",
    description: "Збалансований корм із куркою",
    priceKopecks: 64900,
    stock: 24,
    lowStockThreshold: 5,
    categorySlug: "dog-food",
  },
  {
    sku: "DOG-FOOD-002",
    name: "Консерви для цуценят, 400 г",
    description: "Паштет із телятиною",
    priceKopecks: 12900,
    stock: 3,
    lowStockThreshold: 5,
    categorySlug: "dog-food",
  },
  {
    sku: "CAT-FOOD-001",
    name: "Сухий корм для котів, 1,5 кг",
    description: "Птах і рис",
    priceKopecks: 52900,
    stock: 18,
    lowStockThreshold: 5,
    categorySlug: "cat-food",
  },
  {
    sku: "CAT-FOOD-002",
    name: "Ласощі для котів, 100 г",
    description: "Пастила з куркою",
    priceKopecks: 8900,
    stock: 2,
    lowStockThreshold: 5,
    categorySlug: "cat-food",
  },
  {
    sku: "TOY-001",
    name: "М'ячик для гри з кігтями",
    description: "Не гуде, не дряпає меблі",
    priceKopecks: 14900,
    stock: 40,
    lowStockThreshold: 10,
    categorySlug: "toys",
  },
  {
    sku: "ACC-001",
    name: "Комінець для собак",
    description: "Регульована довжина",
    priceKopecks: 39900,
    stock: 12,
    lowStockThreshold: 4,
    categorySlug: "accessories",
  },
];

type SeedOrder = {
  customerPhone: string;
  status: OrderStatus;
  items: { sku: string; quantity: number }[];
  comment?: string;
};

/**
 * Demo orders give the dashboard and the stock journal something to show. They are created
 * through the order service, so stock movements, totals and status history follow the same
 * rules as in the app.
 */
const SEED_ORDERS: SeedOrder[] = [
  {
    customerPhone: "+380501234567",
    status: "NEW",
    items: [
      { sku: "DOG-FOOD-001", quantity: 2 },
      { sku: "ACC-001", quantity: 1 },
    ],
    comment: "Дзвізок доставки у четверг",
  },
  {
    customerPhone: "+380671112233",
    status: "CONFIRMED",
    items: [{ sku: "CAT-FOOD-001", quantity: 2 }],
  },
  {
    customerPhone: "+380931234567",
    status: "DELIVERED",
    items: [{ sku: "TOY-001", quantity: 1 }],
    comment: "Подарунок, картка з подякою",
  },
  {
    customerPhone: "+380501234567",
    status: "CANCELLED",
    items: [{ sku: "CAT-FOOD-002", quantity: 2 }],
    comment: "Клієнт передумав",
  },
];

/** The steps the service has to take to reach a demo order's final status. */
const STATUS_PATH: Record<OrderStatus, OrderStatus[]> = {
  NEW: [],
  CONFIRMED: ["CONFIRMED"],
  SHIPPED: ["CONFIRMED", "SHIPPED"],
  DELIVERED: ["CONFIRMED", "SHIPPED", "DELIVERED"],
  CANCELLED: ["CANCELLED"],
};

const SEED_CUSTOMERS = [
  { name: "Олена Ковальчук", phone: "+380501234567", email: "olena@example.com" },
  { name: "Тарас Мельник", phone: "+380671112233", email: "taras@example.com" },
  { name: "Марія Савчук", phone: "+380931234567", email: null },
];

async function main() {
  const prisma = createPrismaClient();
  let adminId = "";

  for (const user of SEED_USERS) {
    const passwordHash = await hash(user.password, BCRYPT_COST);
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
      },
    });
    if (saved.role === "ADMIN") adminId = saved.id;
    console.log(`user: ${user.email} (${user.role})`);
  }

  for (const category of SEED_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
  }
  console.log(`categories: ${SEED_CATEGORIES.length}`);

  for (const product of SEED_PRODUCTS) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: product.categorySlug },
    });

    const saved = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        description: product.description,
        priceKopecks: product.priceKopecks,
        lowStockThreshold: product.lowStockThreshold,
        categoryId: category.id,
      },
      // New products start empty so that every unit of stock has a movement behind it.
      create: {
        sku: product.sku,
        name: product.name,
        description: product.description,
        priceKopecks: product.priceKopecks,
        stock: 0,
        lowStockThreshold: product.lowStockThreshold,
        categoryId: category.id,
      },
    });

    // `stock` must equal the sum of the journal deltas (spec section 5.2), so the demo
    // balance is booked as a movement instead of being written directly. Re-running the
    // seed only corrects a balance that drifted.
    const aggregate = await prisma.stockMovement.aggregate({
      where: { productId: saved.id },
      _sum: { delta: true },
    });
    const booked = aggregate._sum.delta ?? 0;
    // Orders already reduced the stock on purpose, so the demo balance is not restored on top
    // of them: pushing it back would invent a correction that hides the ordered units.
    const ordered = await prisma.stockMovement.count({
      where: { productId: saved.id, reason: { in: ["ORDER", "CANCEL"] } },
    });

    if (ordered > 0) continue;

    const delta = product.stock - booked;

    if (delta !== 0) {
      await prisma.$transaction([
        prisma.product.update({ where: { id: saved.id }, data: { stock: product.stock } }),
        prisma.stockMovement.create({
          data: {
            productId: saved.id,
            delta,
            reason: "CORRECTION",
            note: booked === 0 ? "Початковий залишок" : "Коригування seed до демо-залишку",
            createdById: adminId,
          },
        }),
      ]);
    }
  }
  console.log(`products: ${SEED_PRODUCTS.length}`);

  for (const customer of SEED_CUSTOMERS) {
    await prisma.customer.upsert({
      where: { phone: customer.phone },
      update: { name: customer.name, email: customer.email },
      create: customer,
    });
  }
  console.log(`customers: ${SEED_CUSTOMERS.length}`);

  const existingOrders = await prisma.order.count();

  if (existingOrders > 0) {
    console.log(`orders: skipped, ${existingOrders} already in the database`);
  } else {
    for (const seedOrder of SEED_ORDERS) {
      const customer = await prisma.customer.findUniqueOrThrow({
        where: { phone: seedOrder.customerPhone },
        select: { id: true },
      });
      const products = await prisma.product.findMany({
        where: { sku: { in: seedOrder.items.map((item) => item.sku) } },
        select: { id: true, sku: true },
      });
      const idBySku = new Map(products.map((product) => [product.sku, product.id]));

      let order = await createOrder(
        {
          customerId: customer.id,
          items: seedOrder.items.map((item) => ({
            productId: idBySku.get(item.sku) ?? "",
            quantity: item.quantity,
          })),
          comment: seedOrder.comment ?? null,
        },
        adminId,
      );

      // Walk the status through the service, so the history and the movements are real.
      for (const step of STATUS_PATH[seedOrder.status]) {
        order = await changeOrderStatus(order.id, step, adminId);
      }

      console.log(`order: №${order.number} (${seedOrder.status})`);
    }
    console.log(`orders: ${SEED_ORDERS.length}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
