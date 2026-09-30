import { z } from "zod";

import { AppError } from "@/lib/errors";
import { parseUahToKopecks } from "@/lib/money";
import { flattenSearchParams } from "@/lib/search-params";

const skuSchema = z
  .string()
  .trim()
  .min(2, "SKU має містити щонайменше 2 символи")
  .max(32, "SKU не може бути довшим за 32 символи");

const nameSchema = z
  .string()
  .trim()
  .min(2, "Назва має містити щонайменше 2 символи")
  .max(120, "Назва не може бути довшою за 120 символів");

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, "Опис не може бути довшим за 2000 символів")
  .transform((value) => (value === "" ? null : value))
  .nullable();

const priceKopecksSchema = z.coerce
  .number({ error: "Ціна має бути числом" })
  .int("Ціна має бути цілим числом копійок")
  .min(0, "Ціна не може бути від'ємною");

const categoryIdSchema = z.string().trim().min(1, "Оберіть категорію");

const lowStockThresholdSchema = z.coerce
  .number({ error: "Поріг має бути числом" })
  .int("Поріг має бути цілим числом")
  .min(0, "Поріг не може бути від'ємним")
  .max(1_000_000, "Поріг занадто великий");

/** Domain/API payload: prices always travel as integer kopecks (spec section 5.3). */
export const productInputSchema = z.object({
  sku: skuSchema,
  name: nameSchema,
  description: descriptionSchema.optional(),
  priceKopecks: priceKopecksSchema,
  categoryId: categoryIdSchema,
  lowStockThreshold: lowStockThresholdSchema.default(5),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export const productPatchSchema = productInputSchema.partial().extend({
  // `.partial()` would keep the default and silently reset the stored threshold.
  lowStockThreshold: lowStockThresholdSchema.optional(),
  isActive: z.boolean().optional(),
});

export type ProductPatch = z.infer<typeof productPatchSchema>;

/**
 * Form payload. Every field stays a string so react-hook-form, `zodResolver` and the
 * server action agree on one shape; `toProductInput` converts it to the domain payload.
 */
export const productFormSchema = z.object({
  sku: skuSchema,
  name: nameSchema,
  description: z.string().trim().max(2000, "Опис не може бути довшим за 2000 символів"),
  price: z
    .string()
    .trim()
    .min(1, "Введіть ціну")
    .refine((value) => parseUahToKopecks(value) !== null, "Ціна має бути невід'ємним числом"),
  categoryId: categoryIdSchema,
  lowStockThreshold: z
    .string()
    .trim()
    .min(1, "Вкажіть поріг малого залишку")
    .refine(
      (value) => Number.isInteger(Number(value)) && Number(value) >= 0,
      "Поріг має бути цілим невід'ємним числом",
    ),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

/** Converts a validated form payload into the domain payload the services expect. */
export function toProductInput(values: ProductFormValues): ProductInput {
  const priceKopecks = parseUahToKopecks(values.price);

  if (priceKopecks === null) {
    throw new AppError("VALIDATION_ERROR", "Ціна має бути невід'ємним числом", { field: "price" });
  }

  return {
    sku: values.sku,
    name: values.name,
    description: values.description === "" ? null : values.description,
    categoryId: values.categoryId,
    priceKopecks,
    lowStockThreshold: Number(values.lowStockThreshold),
  };
}

const booleanFlag = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((value) => value === true || value === "true" || value === "1");

const positiveInt = z.coerce.number().int().min(1);

export const productListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: z.string().trim().min(1).optional(),
  page: positiveInt.default(1),
  pageSize: positiveInt.max(100).default(20),
  lowStock: booleanFlag.default(false),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/** Query-string values arrive as strings; anything unusable falls back to defaults. */
export function parseProductListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): ProductListQuery {
  const parsed = productListQuerySchema.safeParse(flattenSearchParams(searchParams));
  if (parsed.success) return parsed.data;

  const fallback = productListQuerySchema.safeParse({});
  // Defaults are always valid; the guard keeps TypeScript honest.
  return fallback.success
    ? fallback.data
    : { q: undefined, page: 1, pageSize: 20, lowStock: false };
}
