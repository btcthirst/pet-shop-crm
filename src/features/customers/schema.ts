import { z } from "zod";

import { normalizePhone } from "@/lib/phone";
import { flattenSearchParams } from "@/lib/search-params";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Ім'я має містити щонайменше 2 символи")
  .max(120, "Ім'я не може бути довшим за 120 символів");

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Вкажіть телефон")
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);

    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Телефон має бути у форматі E.164, наприклад +380501234567",
      });
      return z.NEVER;
    }

    return normalized;
  });

/** Optional fields keep an empty string in forms and become `null` in the domain. */
const optionalText = (field: string, max: number, maxMessage: string) =>
  z
    .string()
    .trim()
    .max(max, maxMessage)
    .refine((value) => value === "" || z.email().safeParse(value).success, `Некоректний ${field}`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const optionalNote = z
  .string()
  .trim()
  .max(2000, "Нотатки не можуть бути довшими за 2000 символів")
  .transform((value) => (value === "" ? null : value))
  .nullable();

/** Domain/API payload. `phone` arrives already normalised by the schema. */
export const customerInputSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: optionalText("email", 160, "Email не може бути довшим за 160 символів").optional(),
  notes: optionalNote.optional(),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

export const customerPatchSchema = customerInputSchema.partial();

export type CustomerPatch = z.infer<typeof customerPatchSchema>;

const positiveInt = z.coerce.number().int().min(1);

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: positiveInt.default(1),
  pageSize: positiveInt.max(100).default(20),
});

export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;

/** Query-string values arrive as strings; anything unusable falls back to defaults. */
export function parseCustomerListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): CustomerListQuery {
  const parsed = customerListQuerySchema.safeParse(flattenSearchParams(searchParams));
  if (parsed.success) return parsed.data;

  const fallback = customerListQuerySchema.safeParse({});
  return fallback.success ? fallback.data : { page: 1, pageSize: 20 };
}

/** Form payload: strings only, so react-hook-form, `zodResolver` and the action agree. */
export const customerFormSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .max(160, "Email не може бути довшим за 160 символів")
    .refine((value) => value === "" || z.email().safeParse(value).success, "Некоректний email"),
  notes: z.string().trim().max(2000, "Нотатки не можуть бути довшими за 2000 символів"),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

/** Converts a validated form payload into the domain payload the services expect. */
export function toCustomerInput(values: CustomerFormValues): CustomerInput {
  return {
    name: values.name,
    phone: values.phone,
    email: values.email === "" ? null : values.email,
    notes: values.notes === "" ? null : values.notes,
  };
}
