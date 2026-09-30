import { Prisma } from "@/generated/prisma/client";

import type { CategoryInput, CategoryPatch } from "@/features/categories/schema";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { plural } from "@/lib/plural";
import { toSlug } from "@/lib/slug";

export type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  productsCount: number;
};

export async function listCategories(): Promise<CategoryListItem[]> {
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, _count: { select: { products: true } } },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    productsCount: category._count.products,
  }));
}

export async function getCategory(id: string) {
  const category = await db.category.findUnique({ where: { id } });

  if (!category) {
    throw new AppError("NOT_FOUND", "Категорія не знайдена");
  }

  return category;
}

/** A name that transliterates to an empty slug (e.g. "!!!") cannot be stored. */
function requireSlug(name: string): string {
  const slug = toSlug(name);

  if (slug === "") {
    throw new AppError("VALIDATION_ERROR", "Назва категорії не дає коректного slug", {
      field: "name",
    });
  }

  return slug;
}

/** Names are unique, and the derived slug is what actually collides in the database. */
async function assertSlugIsFree(name: string, ignoreId?: string): Promise<void> {
  const slug = requireSlug(name);
  const existing = await db.category.findFirst({
    where: { slug, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
    select: { id: true },
  });

  if (existing) {
    throw new AppError("VALIDATION_ERROR", "Категорія з такою назвою вже існує", {
      field: "name",
    });
  }
}

export async function createCategory(input: CategoryInput) {
  await assertSlugIsFree(input.name);

  try {
    return await db.category.create({
      data: { name: input.name, slug: requireSlug(input.name) },
    });
  } catch (error) {
    translateWriteError(error);
  }
}

/** Renaming keeps the slug in sync, so the derived link stays readable. */
export async function updateCategory(id: string, patch: CategoryPatch) {
  const existing = await db.category.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Категорія не знайдена");
  }

  if (!patch.name) {
    return getCategory(id);
  }

  await assertSlugIsFree(patch.name, id);

  try {
    return await db.category.update({
      where: { id },
      data: { name: patch.name, slug: requireSlug(patch.name) },
    });
  } catch (error) {
    translateWriteError(error);
  }
}

/** A category that still holds products cannot be deleted (spec section 5.4). */
export async function deleteCategory(id: string): Promise<void> {
  const existing = await db.category.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { products: true } } },
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Категорія не знайдена");
  }

  if (existing._count.products > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Категорію «${existing.name}» не можна видалити: у ній ${existing._count.products} ${plural(existing._count.products, { one: "товар", few: "товари", many: "товарів" })}`,
      { field: "products", productsCount: existing._count.products },
    );
  }

  await db.category.delete({ where: { id } });
}

/** A P2002 here means a duplicate name (and therefore a duplicate derived slug). */
function translateWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError("VALIDATION_ERROR", "Категорія з такою назвою вже існує", {
        field: "name",
      });
    }

    if (error.code === "P2025") {
      throw new AppError("NOT_FOUND", "Категорія не знайдена");
    }
  }

  throw error;
}
