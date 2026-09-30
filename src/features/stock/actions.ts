"use server";

import { revalidatePath } from "next/cache";

import {
  stockMovementFormSchema,
  stockPermissionFor,
  toStockMovementInput,
} from "@/features/stock/schema";
import { createStockMovement } from "@/features/stock/service";
import { toActionState, type ActionState } from "@/lib/action-state";
import { AppError, validationError } from "@/lib/errors";
import { can, requireRole } from "@/lib/permissions";

function revalidateStock(productId: string): void {
  revalidatePath("/stock");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
}

export async function createStockMovementAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    // Same order as the API: identity first, payload second, role last.
    const user = await requireRole("ADMIN", "MANAGER");

    const parsed = stockMovementFormSchema.safeParse({
      productId: formData.get("productId"),
      delta: formData.get("delta"),
      reason: formData.get("reason"),
      note: formData.get("note") ?? "",
    });

    if (!parsed.success) throw validationError(parsed.error);

    // Reuses the API rules, so a Manager cannot sneak a decrease through as RESTOCK.
    const input = toStockMovementInput(parsed.data);

    if (!can(user.role, stockPermissionFor(input.reason))) {
      throw new AppError("FORBIDDEN", "Недостатньо прав для цієї дії");
    }

    const result = await createStockMovement(input, user.id);
    revalidateStock(input.productId);

    return {
      createdId: result.movement.id,
      message: `Залишок змінено: ${result.stockBefore} → ${result.stockAfter}`,
    };
  } catch (error) {
    return toActionState(error, "Не вдалося змінити залишок");
  }
}
