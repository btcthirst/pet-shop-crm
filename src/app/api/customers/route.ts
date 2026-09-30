import { parseCustomerListQuery, customerInputSchema } from "@/features/customers/schema";
import { createCustomer, listCustomers } from "@/features/customers/service";

import { toErrorBody, validationError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    await requirePermission("CUSTOMER_VIEW");

    const query = parseCustomerListQuery(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    return Response.json(await listCustomers(query));
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission("CUSTOMER_WRITE");

    const payload: unknown = await request.json().catch(() => null);
    const parsed = customerInputSchema.safeParse(payload);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    return Response.json({ customer: await createCustomer(parsed.data) }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
