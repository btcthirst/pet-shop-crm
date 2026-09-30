import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Користувачі" };

export default async function UsersPage() {
  const user = await getCurrentUser();

  // Server-side gate: Manager is refused here even though the nav link is hidden for them.
  // The page renders an inline notice instead of Next's experimental `forbidden()` so the
  // stack stays on stable APIs; Route Handlers return a real 403 for the same rule.
  if (!user || user.role !== "ADMIN") {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Доступ заборонено</h1>
        <p className="text-muted-foreground">Розділ доступний лише користувачам з роллю Admin.</p>
      </section>
    );
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Користувачі</h1>

      <Card>
        <CardHeader>
          <CardTitle>Облікові записи</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {users.map((account) => (
              <li key={account.id} className="flex items-center gap-3">
                <span className="font-medium">{account.name}</span>
                <span className="text-muted-foreground">{account.email}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {account.role === "ADMIN" ? "Admin" : "Manager"}
                </span>
                {!account.isActive ? (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    деактивовано
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
