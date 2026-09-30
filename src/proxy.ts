import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

/**
 * Auth.js wrapper used as the Next.js 16 proxy. It verifies the JWT session on every
 * matched request and redirects anonymous visitors to /login (see `authorized`).
 * The function is wrapped in a declaration because Next.js only recognises proxy
 * functions that are statically analysable as exports.
 */
const { auth } = NextAuth(authConfig);

export function proxy(...args: Parameters<typeof auth>) {
  return auth(...args);
}

/**
 * The proxy protects page routes; every matcher entry below is intentionally public.
 * `api` is excluded because Route Handlers answer with the documented JSON error
 * contract (401/403) instead of redirects, see requireRole().
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
