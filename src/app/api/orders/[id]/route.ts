import { getOrder } from "@/features/orders/service";

import { toErrorBody } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requirePermission("ORDER_VIEW");

    const { id } = await params;

    return Response.json({ order: await getOrder(id) });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
