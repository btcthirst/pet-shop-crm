import { Prisma } from "@/generated/prisma/client";

import type { ProductInput, ProductListQuery, ProductPatch } from "@/features/products/schema";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

export type ProductListItem = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceKopecks: number;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
  isLowStock: boolean;
};

export type ProductListResult = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ProductListRow = Omit<ProductListItem, "isLowStock"> & { isLowStock: boolean };

const productSelect = Prisma.sql`
  p.id, p.sku, p.name, p.description, p."priceKopecks", p.stock, p."lowStockThreshold",
  p."isActive", p."categoryId", c.name AS "categoryName",
  (p.stock <= p."lowStockThreshold") AS "isLowStock"
`;

/**
 * Filters live in raw SQL because `lowStock` compares two columns
 * (`stock <= lowStockThreshold`), which the typed `where` API cannot express.
 */
function buildFilters(query: ProductListQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (query.q) {
    const pattern = `%${query.q}%`;
    conditions.push(Prisma.sql`(p.name ILIKE ${pattern} OR p.sku ILIKE ${pattern})`);
  }

  if (query.categoryId) {
    conditions.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
  }

  if (query.lowStock) {
    conditions.push(Prisma.sql`p.stock <= p."lowStockThreshold"`);
  }

  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;
}

/**
 * Product has exactly one business unique key (`sku`), so a P2002 can only mean a
 * duplicated SKU. Prisma 7 with a driver adapter does not report the constraint name,
 * hence the explicit message instead of inspecting `meta.target`.
 */
function translateWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError("VALIDATION_ERROR", "Такий SKU вже існує", { field: "sku" });
    }

    if (error.code === "P2025") {
      throw new AppError("NOT_FOUND", "Товар не знайдено");
    }
  }

  throw error;
}

export async function listProducts(query: ProductListQuery): Promise<ProductListResult> {
  const where = buildFilters(query);
  const skip = (query.page - 1) * query.pageSize;

  const [rows, totals] = await db.$transaction([
    db.$queryRaw<ProductListRow[]>(Prisma.sql`
      SELECT ${productSelect}
      FROM "Product" p
      JOIN "Category" c ON c.id = p."categoryId"
      ${where}
      ORDER BY p.name ASC, p.sku ASC
      LIMIT ${query.pageSize} OFFSET ${skip}
    `),
    db.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "Product" p
      ${where}
    `),
  ]);

  const total = Number(totals[0]?.count ?? 0);

  return {
    items: rows.map(({ isLowStock, ...row }) => ({ ...row, isLowStock })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getProduct(id: string) {
  const product = await db.product.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });

  if (!product) {
    throw new AppError("NOT_FOUND", "Товар не знайдено");
  }

  return product;
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new AppError("VALIDATION_ERROR", "Обрана категорія не існує", { field: "categoryId" });
  }
}

export async function createProduct(input: ProductInput) {
  await assertCategoryExists(input.categoryId);

  try {
    return await db.product.create({
      data: {
        sku: input.sku,
        name: input.name,
        description: input.description ?? null,
        priceKopecks: input.priceKopecks,
        lowStockThreshold: input.lowStockThreshold,
        categoryId: input.categoryId,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  } catch (error) {
    translateWriteError(error);
  }
}

export async function updateProduct(id: string, patch: ProductPatch) {
  const existing = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Товар не знайдено");
  }

  if (patch.categoryId) {
    await assertCategoryExists(patch.categoryId);
  }

  try {
    return await db.product.update({
      where: { id },
      data: {
        ...(patch.sku === undefined ? {} : { sku: patch.sku }),
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.description === undefined ? {} : { description: patch.description }),
        ...(patch.priceKopecks === undefined ? {} : { priceKopecks: patch.priceKopecks }),
        ...(patch.lowStockThreshold === undefined
          ? {}
          : { lowStockThreshold: patch.lowStockThreshold }),
        ...(patch.categoryId === undefined ? {} : { categoryId: patch.categoryId }),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  } catch (error) {
    translateWriteError(error);
  }
}

/**
 * Products are never deleted — an ordered one is deactivated instead (spec section 5.4).
 * `stock` is intentionally not writable here: it only changes through stock movements.
 */
export async function setProductActive(id: string, isActive: boolean) {
  const existing = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Товар не знайдено");
  }

  return db.product.update({ where: { id }, data: { isActive } });
}
