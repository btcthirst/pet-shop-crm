import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCustomerAction } from "@/features/customers/actions";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Новий клієнт" };

export default async function NewCustomerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Новий клієнт</h1>
        <p className="text-muted-foreground">
          Телефон зберігається у форматі E.164 і має бути унікальним.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Дані клієнта</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerForm action={createCustomerAction} submitLabel="Створити клієнта" />
        </CardContent>
      </Card>
    </section>
  );
}
