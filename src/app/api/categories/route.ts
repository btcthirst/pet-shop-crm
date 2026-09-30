import { createCategory, listCategories } from "@/features/categories/service";
import { categoryInputSchema } from "@/features/categories/schema";

import { toErrorBody, validationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

export async function GET() {
  try {
    await requirePermission("CATALOG_VIEW");

    return Response.json({ categories: await listCategories() });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission("CATEGORY_WRITE");

    const payload: unknown = await request.json().catch(() => null);
    const parsed = categoryInputSchema.safeParse(payload);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    return Response.json({ category: await createCategory(parsed.data) }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
