import { toErrorBody } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

export async function GET() {
  try {
    await requirePermission("USER_MANAGE");

    // Placeholder payload: user management (create, deactivate) arrives with the
    // catalogue stage, the role gate is the part that matters here.
    return Response.json({ users: [] });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
