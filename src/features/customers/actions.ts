"use server";

import { revalidatePath } from "next/cache";

import { customerFormSchema, toCustomerInput } from "@/features/customers/schema";
import { createCustomer, deleteCustomer, updateCustomer } from "@/features/customers/service";
import { toActionState, type ActionState } from "@/lib/action-state";
import { validationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

function revalidateCustomers(id?: string): void {
  revalidatePath("/customers");
  if (id) revalidatePath(`/customers/${id}`);
}

export async function createCustomerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requirePermission("CUSTOMER_WRITE");

    const parsed = customerFormSchema.safeParse({
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email") ?? "",
      notes: formData.get("notes") ?? "",
    });

    if (!parsed.success) throw validationError(parsed.error);

    const customer = await createCustomer(toCustomerInput(parsed.data));
    revalidateCustomers(customer.id);

    return { createdId: customer.id, message: "Клієнта збережено" };
  } catch (error) {
    return toActionState(error, "Не вдалося зберегти клієнта");
  }
}

export async function updateCustomerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requirePermission("CUSTOMER_WRITE");

    const id = formData.get("id");
    if (typeof id !== "string" || id === "") {
      return { error: "Не вдалося визначити клієнта" };
    }

    const parsed = customerFormSchema.safeParse({
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email") ?? "",
      notes: formData.get("notes") ?? "",
    });

    if (!parsed.success) throw validationError(parsed.error);

    await updateCustomer(id, toCustomerInput(parsed.data));
    revalidateCustomers(id);

    return { createdId: id, message: "Зміни збережено" };
  } catch (error) {
    return toActionState(error, "Не вдалося зберегти клієнта");
  }
}

export async function deleteCustomerAction(id: string): Promise<void> {
  await requirePermission("CUSTOMER_DELETE");

  await deleteCustomer(id);
  revalidateCustomers(id);
}
