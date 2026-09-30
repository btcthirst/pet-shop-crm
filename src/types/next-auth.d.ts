import type { DefaultSession } from "next-auth";

import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
  }
}

/**
 * The JWT interface cannot be augmented from here: `next-auth/jwt` only re-exports the
 * type from `@auth/core`, which pnpm does not expose to this project. The token shape
 * is therefore described by `SessionToken` in src/lib/auth.config.ts.
 */
export type {};
