import { z } from "zod";

const categoryNameSchema = z
  .string()
  .trim()
  .min(2, "Назва категорії має містити щонайменше 2 символи")
  .max(60, "Назва категорії не може бути довшою за 60 символів");

export const categoryInputSchema = z.object({ name: categoryNameSchema });

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const categoryPatchSchema = categoryInputSchema.partial();

export type CategoryPatch = z.infer<typeof categoryPatchSchema>;
