import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

import type { Role } from "../src/generated/prisma/enums";

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

const SEED_CUSTOMERS = [
  { name: "Олена Ковальчук", phone: "+380501234567", email: "olena@example.com" },
  { name: "Тарас Мельник", phone: "+380671112233", email: "taras@example.com" },
  { name: "Марія Савчук", phone: "+380931234567", email: null },
];

async function main() {
  const prisma = createPrismaClient();

  for (const user of SEED_USERS) {
    const passwordHash = await hash(user.password, BCRYPT_COST);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
      },
    });
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

    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        description: product.description,
        priceKopecks: product.priceKopecks,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        categoryId: category.id,
      },
      create: {
        sku: product.sku,
        name: product.name,
        description: product.description,
        priceKopecks: product.priceKopecks,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        categoryId: category.id,
      },
    });
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

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
