"use server";

import { revalidatePath } from "next/cache";

import { productFormSchema, toProductInput } from "@/features/products/schema";
import { createProduct, setProductActive, updateProduct } from "@/features/products/service";
import { toActionState, type ActionState } from "@/lib/action-state";
import { validationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

function formValues(formData: FormData) {
  return {
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    price: formData.get("price"),
  };
}

function revalidateCatalogue(id?: string): void {
  revalidatePath("/products");
  revalidatePath("/categories");
  if (id) revalidatePath(`/products/${id}`);
}

export async function createProductAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requirePermission("PRODUCT_WRITE");

    const parsed = productFormSchema.safeParse(formValues(formData));
    if (!parsed.success) throw validationError(parsed.error);

    const product = await createProduct(toProductInput(parsed.data));
    revalidateCatalogue();

    return { createdId: product.id };
  } catch (error) {
    return toActionState(error, "Не вдалося створити товар");
  }
}

export async function updateProductAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requirePermission("PRODUCT_WRITE");

    const id = formData.get("id");
    if (typeof id !== "string" || id === "") {
      return { error: "Не вдалося визначити товар" };
    }

    const parsed = productFormSchema.safeParse(formValues(formData));
    if (!parsed.success) throw validationError(parsed.error);

    // The form always submits a price, so the dedicated price permission is checked
    // explicitly instead of relying on PRODUCT_WRITE being Admin-only.
    await requirePermission("PRODUCT_PRICE_CHANGE");
    await updateProduct(id, toProductInput(parsed.data));
    revalidateCatalogue(id);

    return { createdId: id };
  } catch (error) {
    return toActionState(error, "Не вдалося зберегти товар");
  }
}

export async function setProductActiveAction(id: string, isActive: boolean): Promise<void> {
  await requirePermission("PRODUCT_DEACTIVATE");

  await setProductActive(id, isActive);
  revalidateCatalogue(id);
}
