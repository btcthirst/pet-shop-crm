import {
  parseStockMovementListQuery,
  stockMovementInputSchema,
  stockPermissionFor,
} from "@/features/stock/schema";
import { createStockMovement, listStockMovements } from "@/features/stock/service";

import { AppError, toErrorBody, validationError } from "@/lib/errors";
import { can, requirePermission, requireRole } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    await requirePermission("STOCK_VIEW");

    const query = parseStockMovementListQuery(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    return Response.json(await listStockMovements(query));
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    // Authorisation runs before payload validation, so an anonymous caller gets 401
    // instead of learning the validation rules from a 400.
    const user = await requireRole("ADMIN", "MANAGER");

    const payload: unknown = await request.json().catch(() => null);
    const parsed = stockMovementInputSchema.safeParse(payload);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    if (!can(user.role, stockPermissionFor(parsed.data.reason))) {
      throw new AppError("FORBIDDEN", "Недостатньо прав для цієї дії");
    }

    return Response.json(await createStockMovement(parsed.data, user.id), { status: 201 });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
