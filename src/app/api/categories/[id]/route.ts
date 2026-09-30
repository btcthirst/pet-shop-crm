import { categoryPatchSchema } from "@/features/categories/schema";
import { deleteCategory, updateCategory } from "@/features/categories/service";

import { toErrorBody, validationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requirePermission("CATEGORY_WRITE");

    const payload: unknown = await request.json().catch(() => null);
    const parsed = categoryPatchSchema.safeParse(payload);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    return Response.json({
      category: await updateCategory((await context.params).id, parsed.data),
    });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requirePermission("CATEGORY_WRITE");

    await deleteCategory((await context.params).id);

    return new Response(null, { status: 204 });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
