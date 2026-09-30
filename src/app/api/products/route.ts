import { parseProductListQuery, productInputSchema } from "@/features/products/schema";
import { createProduct, listProducts } from "@/features/products/service";

import { toErrorBody, validationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    await requirePermission("CATALOG_VIEW");

    const query = parseProductListQuery(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    return Response.json(await listProducts(query));
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission("PRODUCT_WRITE");

    const payload: unknown = await request.json().catch(() => null);
    const parsed = productInputSchema.safeParse(payload);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    return Response.json({ product: await createProduct(parsed.data) }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
