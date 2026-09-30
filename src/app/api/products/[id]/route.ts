import { productPatchSchema } from "@/features/products/schema";
import { getProduct, setProductActive, updateProduct } from "@/features/products/service";

import { toErrorBody, validationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission("CATALOG_VIEW");

    return Response.json({ product: await getProduct((await context.params).id) });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requirePermission("PRODUCT_WRITE");

    const payload: unknown = await request.json().catch(() => null);
    const parsed = productPatchSchema.safeParse(payload);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const { id } = await context.params;
    const { isActive, ...fields } = parsed.data;

    // Price and activation are separate permissions in the role matrix (spec section 3),
    // so each one is checked even though PRODUCT_WRITE already limits the caller to Admin.
    if (fields.priceKopecks !== undefined) {
      await requirePermission("PRODUCT_PRICE_CHANGE");
    }

    if (isActive !== undefined) {
      await requirePermission("PRODUCT_DEACTIVATE");
    }

    const product = await updateProduct(id, fields);

    return Response.json({
      product: isActive === undefined ? product : await setProductActive(id, isActive),
    });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requirePermission("PRODUCT_DEACTIVATE");

    // Products are deactivated, never deleted (spec section 5.4).
    await setProductActive((await context.params).id, false);

    return new Response(null, { status: 204 });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
