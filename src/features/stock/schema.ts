import { z } from "zod";

import { AppError } from "@/lib/errors";
import { flattenSearchParams } from "@/lib/search-params";

/** ORDER and CANCEL are written by the orders feature only (spec section 5.2). */
export const MANUAL_STOCK_REASONS = ["RESTOCK", "CORRECTION"] as const;

export type ManualStockReason = (typeof MANUAL_STOCK_REASONS)[number];

/** Receiving goods is open to Manager, correcting a balance is Admin only (spec section 3). */
export function stockPermissionFor(
  reason: ManualStockReason,
): "STOCK_RESTOCK" | "STOCK_CORRECTION" {
  return reason === "CORRECTION" ? "STOCK_CORRECTION" : "STOCK_RESTOCK";
}

export const STOCK_REASON_LABELS: Record<"RESTOCK" | "CORRECTION" | "ORDER" | "CANCEL", string> = {
  RESTOCK: "Прихід на склад",
  CORRECTION: "Коригування залишку",
  ORDER: "Списання на замовлення",
  CANCEL: "Повернення зі скасування",
};

const deltaSchema = z.coerce
  .number({ error: "Кількість має бути числом" })
  .int("Кількість має бути цілим числом")
  .refine((value) => value !== 0, "Кількість не може бути нульовою");

/**
 * Manual stock input: `delta` is signed — positive adds units, negative takes them.
 * RESTOCK is an inflow, so only CORRECTION may reduce the balance (spec section 3).
 */
export const stockMovementInputSchema = z
  .object({
    productId: z.string().trim().min(1, "Оберіть товар"),
    delta: deltaSchema,
    reason: z.enum(MANUAL_STOCK_REASONS, { error: "Невідома причина руху" }),
    note: z.string().trim().max(500, "Нотатка не може бути довшою за 500 символів").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.reason === "RESTOCK" && value.delta < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["delta"],
        message: "Прихід може бути лише додатковим",
      });
    }
  });

export type StockMovementInput = z.infer<typeof stockMovementInputSchema>;

const positiveInt = z.coerce.number().int().min(1);

export const stockMovementListQuerySchema = z.object({
  productId: z.string().trim().min(1).optional(),
  reason: z.enum(["RESTOCK", "CORRECTION", "ORDER", "CANCEL"]).optional(),
  page: positiveInt.default(1),
  pageSize: positiveInt.max(100).default(20),
});

export type StockMovementListQuery = z.infer<typeof stockMovementListQuerySchema>;

export function parseStockMovementListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): StockMovementListQuery {
  const parsed = stockMovementListQuerySchema.safeParse(flattenSearchParams(searchParams));
  if (parsed.success) return parsed.data;

  const fallback = stockMovementListQuerySchema.safeParse({});
  // Defaults are always valid; the guard keeps TypeScript honest.
  return fallback.success ? fallback.data : { page: 1, pageSize: 20 };
}

/** Form payload: every field stays a string so react-hook-form and the server agree. */
export const stockMovementFormSchema = z.object({
  productId: z.string().trim().min(1, "Оберіть товар"),
  delta: z
    .string()
    .trim()
    .min(1, "Вкажіть кількість")
    .refine((value) => /^-?\d+$/.test(value), "Кількість має бути цілим числом")
    .refine((value) => Number(value) !== 0, "Кількість не може бути нульовою"),
  reason: z.enum(MANUAL_STOCK_REASONS, { error: "Оберіть причину" }),
  note: z.string().trim().max(500, "Нотатка не може бути довшою за 500 символів"),
});

export type StockMovementFormValues = z.infer<typeof stockMovementFormSchema>;

/**
 * Converts a validated form payload into the domain payload. Reuses the API rules, so
 * a Manager cannot sneak a stock decrease through the form under a RESTOCK label.
 */
export function toStockMovementInput(values: StockMovementFormValues): StockMovementInput {
  const parsed = stockMovementInputSchema.safeParse({
    productId: values.productId,
    delta: values.delta,
    reason: values.reason,
    note: values.note,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AppError("VALIDATION_ERROR", issue?.message ?? "Перевірте заповнення форми", {
      field: issue?.path.join(".") || "delta",
    });
  }

  return parsed.data;
}
