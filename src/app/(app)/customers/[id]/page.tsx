import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateCustomerAction } from "@/features/customers/actions";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { DeleteCustomerButton } from "@/features/customers/components/delete-customer-button";
import { getCustomer } from "@/features/customers/service";
import { ORDER_STATUS_LABELS } from "@/features/orders/status";
import { isAppError } from "@/lib/errors";
import { formatKopecks } from "@/lib/money";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Картка клієнта" };

const dateFormatter = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "short",
  timeStyle: "short",
});

type CustomerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerPage({ params }: CustomerPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  let customer: Awaited<ReturnType<typeof getCustomer>>;
  try {
    customer = await getCustomer(id);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const canDelete = user.role === "ADMIN";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          <p className="text-muted-foreground">
            {customer.phone}
            {customer.email ? ` · ${customer.email}` : ""} · з{" "}
            {dateFormatter.format(customer.createdAt)}
          </p>
        </div>

        <Link href="/customers" className="text-sm hover:underline">
          ← До списку
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Редагування</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerForm
            action={updateCustomerAction}
            submitLabel="Зберегти зміни"
            hiddenId={customer.id}
            defaultValues={{
              name: customer.name,
              phone: customer.phone,
              email: customer.email ?? "",
              notes: customer.notes ?? "",
            }}
          />
        </CardContent>
      </Card>

      {canDelete ? (
        <Card>
          <CardHeader>
            <CardTitle>Видалення</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Клієнта можна видалити, лише якщо в нього немає замовлень.
            </p>
            <DeleteCustomerButton customerId={customer.id} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Замовлення ({customer.orders.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {customer.orders.length === 0 ? (
            <p className="px-6 py-8 text-center text-muted-foreground">
              Замовлень ще немає — вони з&apos;являться тут автоматично.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="px-6 py-2 font-medium">№</th>
                    <th className="px-6 py-2 font-medium">Дата</th>
                    <th className="px-6 py-2 font-medium">Статус</th>
                    <th className="px-6 py-2 text-right font-medium">Сума</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="px-6 py-2">
                        <Link href={`/orders/${order.id}`} className="font-medium hover:underline">
                          {order.number}
                        </Link>
                      </td>
                      <td className="px-6 py-2 text-muted-foreground">
                        {dateTimeFormatter.format(order.createdAt)}
                      </td>
                      <td className="px-6 py-2">{ORDER_STATUS_LABELS[order.status]}</td>
                      <td className="px-6 py-2 text-right">{formatKopecks(order.totalKopecks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
