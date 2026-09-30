import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Дашборд" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Вітаємо, {user.name}</h1>
        <p className="text-muted-foreground">
          Роль: {user.role === "ADMIN" ? "Admin" : "Manager"}. Нові замовлення та товари з малим
          залишком з&apos;являться тут на етапі 6.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Нові замовлення</CardTitle>
            <CardDescription>Етап 6</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">—</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Малий залишок</CardTitle>
            <CardDescription>Етап 6</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">—</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Каталог</CardTitle>
            <CardDescription>Етап 2</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">—</CardContent>
        </Card>
      </div>
    </section>
  );
}
