"use server";

import { revalidatePath } from "next/cache";

import { categoryInputSchema } from "@/features/categories/schema";
import { createCategory, deleteCategory, updateCategory } from "@/features/categories/service";
import { toActionState, type ActionState } from "@/lib/action-state";
import { validationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

export async function createCategoryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requirePermission("CATEGORY_WRITE");

    const parsed = categoryInputSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) throw validationError(parsed.error);

    await createCategory(parsed.data);
    revalidatePath("/categories");
    revalidatePath("/products");

    return { ok: true };
  } catch (error) {
    return toActionState(error, "Не вдалося створити категорію");
  }
}

export async function renameCategoryAction(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requirePermission("CATEGORY_WRITE");

    const parsed = categoryInputSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) throw validationError(parsed.error);

    await updateCategory(id, parsed.data);
    revalidatePath("/categories");
    revalidatePath("/products");

    return { ok: true };
  } catch (error) {
    return toActionState(error, "Не вдалося перейменувати категорію");
  }
}

export async function deleteCategoryAction(id: string): Promise<void> {
  await requirePermission("CATEGORY_WRITE");

  await deleteCategory(id);
  revalidatePath("/categories");
  revalidatePath("/products");
}
