"use server";

import { revalidatePath } from "next/cache";

import {
  orderFormSchema,
  orderStatusInputSchema,
  parseOrderFormData,
  toOrderInput,
} from "@/features/orders/schema";
import { changeOrderStatus, createOrder } from "@/features/orders/service";

import { toActionState, type ActionState } from "@/lib/action-state";
import { validationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

export async function createOrderAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("ORDER_CREATE");

    const parsed = orderFormSchema.safeParse(parseOrderFormData(formData));
    if (!parsed.success) throw validationError(parsed.error);

    const order = await createOrder(toOrderInput(parsed.data), user.id);

    revalidatePath("/orders");
    revalidatePath("/stock");
    revalidatePath(`/customers/${order.customer.id}`);

    return { createdId: order.id, message: `Замовлення №${order.number} створено` };
  } catch (error) {
    return toActionState(error, "Не вдалося створити замовлення");
  }
}

export async function changeOrderStatusAction(id: string, toStatus: string): Promise<void> {
  const user = await requirePermission("ORDER_STATUS_CHANGE");

  const parsed = orderStatusInputSchema.safeParse({ toStatus });
  if (!parsed.success) throw validationError(parsed.error, "Невідомий статус замовлення");

  await changeOrderStatus(id, parsed.data.toStatus, user.id);

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/stock");
}
