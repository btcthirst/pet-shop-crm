import { orderInputSchema, parseOrderListQuery } from "@/features/orders/schema";
import { createOrder, listOrders } from "@/features/orders/service";

import { toErrorBody, validationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    await requirePermission("ORDER_VIEW");

    const query = parseOrderListQuery(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    return Response.json(await listOrders(query));
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("ORDER_CREATE");

    const payload: unknown = await request.json().catch(() => null);
    const parsed = orderInputSchema.safeParse(payload);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    return Response.json({ order: await createOrder(parsed.data, user.id) }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
