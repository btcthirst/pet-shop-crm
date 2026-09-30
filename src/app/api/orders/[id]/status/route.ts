import { orderStatusInputSchema } from "@/features/orders/schema";
import { changeOrderStatus } from "@/features/orders/service";

import { toErrorBody, validationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requirePermission("ORDER_STATUS_CHANGE");

    const { id } = await params;
    const payload: unknown = await request.json().catch(() => null);
    const parsed = orderStatusInputSchema.safeParse(payload);

    if (!parsed.success) {
      throw validationError(parsed.error, "Невідомий статус замовлення");
    }

    return Response.json({ order: await changeOrderStatus(id, parsed.data.toStatus, user.id) });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
