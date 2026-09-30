import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

import type { Role } from "@/generated/prisma/enums";

/**
 * Server-side role matrix (spec section 3). Every Route Handler and Server Action must
 * call requireRole()/requirePermission() — hiding buttons in the UI is convenience only.
 */
export const PERMISSIONS = {
  CATALOG_VIEW: ["ADMIN", "MANAGER"],
  PRODUCT_WRITE: ["ADMIN"],
  PRODUCT_PRICE_CHANGE: ["ADMIN"],
  PRODUCT_DEACTIVATE: ["ADMIN"],
  CATEGORY_WRITE: ["ADMIN"],
  STOCK_VIEW: ["ADMIN", "MANAGER"],
  STOCK_RESTOCK: ["ADMIN", "MANAGER"],
  STOCK_CORRECTION: ["ADMIN"],
  CUSTOMER_VIEW: ["ADMIN", "MANAGER"],
  CUSTOMER_WRITE: ["ADMIN", "MANAGER"],
  CUSTOMER_DELETE: ["ADMIN"],
  ORDER_VIEW: ["ADMIN", "MANAGER"],
  ORDER_CREATE: ["ADMIN", "MANAGER"],
  ORDER_STATUS_CHANGE: ["ADMIN", "MANAGER"],
  USER_MANAGE: ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Session of the current request, or null. Use in pages to render UI. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || !user.email || !user.name) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/**
 * Server-side authorisation gate. Throws AppError (UNAUTHORIZED 401 / FORBIDDEN 403)
 * so Route Handlers can map it to the documented error contract.
 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("UNAUTHORIZED", "Потрібно увійти в систему");
  }

  if (!roles.includes(user.role)) {
    throw new AppError("FORBIDDEN", "Недостатньо прав для цієї дії");
  }

  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireRole("ADMIN", "MANAGER");

  if (!can(user.role, permission)) {
    throw new AppError("FORBIDDEN", "Недостатньо прав для цієї дії");
  }

  return user;
}
