import { customerPatchSchema } from "@/features/customers/schema";
import { deleteCustomer, getCustomer, updateCustomer } from "@/features/customers/service";

import { toErrorBody, validationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requirePermission("CUSTOMER_VIEW");

    const { id } = await params;

    return Response.json({ customer: await getCustomer(id) });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await requirePermission("CUSTOMER_WRITE");

    const { id } = await params;
    const payload: unknown = await request.json().catch(() => null);
    const parsed = customerPatchSchema.safeParse(payload);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    return Response.json({ customer: await updateCustomer(id, parsed.data) });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    await requirePermission("CUSTOMER_DELETE");

    const { id } = await params;
    await deleteCustomer(id);

    return new Response(null, { status: 204 });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
