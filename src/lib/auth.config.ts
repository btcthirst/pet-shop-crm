import type { NextAuthConfig } from "next-auth";

import type { Role } from "@/generated/prisma/enums";

/** JWT claims added by the credentials provider; see the note in src/types/next-auth.d.ts. */
type SessionToken = {
  id: string;
  role: Role;
};

/**
 * Config shared by the Node.js runtime (route handler, server actions) and the proxy.
 * Type-only imports keep this file free of database code so the proxy bundle stays
 * free of Node.js-only dependencies.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    /**
     * Runs in the proxy: `false` sends unauthenticated visitors to the sign-in page.
     * Route handlers enforce permissions themselves through requireRole().
     */
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      const { id, role } = token as SessionToken;
      session.user.id = id;
      session.user.role = role;
      return session;
    },
  },
} satisfies NextAuthConfig;

export type AuthRole = Role;
