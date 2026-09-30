import { getDashboard } from "@/features/dashboard/service";

import { toErrorBody } from "@/lib/errors";
import { requireRole } from "@/lib/permissions";

export async function GET() {
  try {
    // The dashboard reads orders, stock and the catalogue at once, and every role that can
    // sign in has access to all three (spec section 6.1), so the gate is the role itself.
    await requireRole("ADMIN", "MANAGER");

    return Response.json(await getDashboard());
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
