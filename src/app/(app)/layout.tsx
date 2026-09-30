import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { can, getCurrentUser } from "@/lib/permissions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Дашборд" },
  { href: "/users", label: "Користувачі", permission: "USER_MANAGE" as const },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  // The proxy already redirects anonymous visitors; this keeps pages safe on their own.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-3">
          <Link href="/dashboard" className="font-semibold">
            pet-shop-crm
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            {NAV_ITEMS.filter((item) => !item.permission || can(user.role, item.permission)).map(
              (item) => (
                <Link key={item.href} href={item.href} className="hover:underline">
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {user.name} · {user.role === "ADMIN" ? "Admin" : "Manager"}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
