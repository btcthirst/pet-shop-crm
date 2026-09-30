import { z } from "zod";

import { flattenSearchParams } from "@/lib/search-params";

import { ORDER_STATUSES } from "@/features/orders/status";

const idSchema = z.string().trim().min(1);

const quantitySchema = z.coerce
  .number({ error: "Кількість має бути цілим числом" })
  .int("Кількість має бути цілим числом")
  .min(1, "Кількість має бути не менше 1");

const itemSchema = z.object({
  productId: idSchema,
  quantity: quantitySchema,
});

/** An order needs at least one line and the same product may not appear twice (spec 5.5). */
const itemsSchema = z
  .array(itemSchema)
  .min(1, "Замовлення має містити щонайменше одну позицію")
  .refine(
    (items) => new Set(items.map((item) => item.productId)).size === items.length,
    "Товари в замовленні не повторюються",
  );

const commentSchema = z
  .string()
  .trim()
  .max(1000, "Коментар не може бути довшим за 1000 символів")
  .transform((value) => (value === "" ? null : value))
  .nullable();

/** Domain/API payload for order creation. `totalKopecks` from the client is ignored. */
export const orderInputSchema = z.object({
  customerId: idSchema,
  items: itemsSchema,
  comment: commentSchema.optional(),
});

export type OrderInput = z.infer<typeof orderInputSchema>;

export const orderStatusInputSchema = z.object({
  toStatus: z.enum(ORDER_STATUSES, { error: "Невідомий статус замовлення" }),
});

export type OrderStatusInput = z.infer<typeof orderStatusInputSchema>;

const positiveInt = z.coerce.number().int().min(1);

export const orderListQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  customerId: idSchema.optional(),
  page: positiveInt.default(1),
  pageSize: positiveInt.max(100).default(20),
});

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

/** Query-string values arrive as strings; anything unusable falls back to defaults. */
export function parseOrderListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): OrderListQuery {
  const parsed = orderListQuerySchema.safeParse(flattenSearchParams(searchParams));
  if (parsed.success) return parsed.data;

  const fallback = orderListQuerySchema.safeParse({});
  return fallback.success ? fallback.data : { page: 1, pageSize: 20 };
}

/** Form payload: quantities stay strings so react-hook-form can bind plain inputs. */
export const orderFormSchema = z.object({
  customerId: z.string().trim().min(1, "Оберіть клієнта"),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1, "Оберіть товар"),
        quantity: z
          .string()
          .trim()
          .min(1, "Вкажіть кількість")
          .refine((value) => Number.isInteger(Number(value)) && Number(value) >= 1, {
            message: "Кількість має бути цілим числом не менше 1",
          }),
      }),
    )
    .min(1, "Додайте щонайменше одну позицію")
    .refine(
      (items) => new Set(items.map((item) => item.productId)).size === items.length,
      "Товари в замовленні не повторюються",
    ),
  comment: z.string().trim().max(1000, "Коментар не може бути довшим за 1000 символів"),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;

/** Validates the form shape and produces the domain payload the service expects. */
export function toOrderInput(values: OrderFormValues): OrderInput {
  return {
    customerId: values.customerId,
    items: values.items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
    })),
    comment: values.comment === "" ? null : values.comment,
  };
}

/**
 * Rebuilds the form payload from FormData, where repeating rows are named
 * `items.0.productId`, `items.1.quantity`, and so on.
 */
export function parseOrderFormData(formData: FormData): unknown {
  const rows = new Map<number, { productId: string; quantity: string }>();

  for (const [key, value] of formData.entries()) {
    const match = /^items\.(\d+)\.(productId|quantity)$/.exec(key);
    if (!match) continue;

    const index = Number(match[1]);
    const field = match[2];
    const row = rows.get(index) ?? { productId: "", quantity: "" };

    rows.set(index, { ...row, [field]: String(value ?? "") });
  }

  return {
    customerId: formData.get("customerId"),
    comment: formData.get("comment") ?? "",
    items: [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row),
  };
}
