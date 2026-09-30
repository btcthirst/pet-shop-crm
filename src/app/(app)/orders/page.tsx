import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { parseOrderListQuery } from "@/features/orders/schema";
import { listOrders } from "@/features/orders/service";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/features/orders/status";
import { listCustomers } from "@/features/customers/service";
import { formatKopecks } from "@/lib/money";
import { getCurrentUser } from "@/lib/permissions";

import type { OrderListQuery } from "@/features/orders/schema";

export const metadata = { title: "Замовлення" };

const dateTimeFormatter = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "short",
  timeStyle: "short",
});

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const query = parseOrderListQuery(params);
  const [result, customers] = await Promise.all([
    listOrders(query),
    listCustomers({ page: 1, pageSize: 100 }),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Замовлення</h1>
          <p className="text-muted-foreground">Знайдено {result.total}</p>
        </div>

        <Link
          href="/orders/new"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Нове замовлення
        </Link>
      </div>

      <Card>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-44 flex-col gap-2">
              <Label htmlFor="status">Статус</Label>
              <select
                id="status"
                name="status"
                defaultValue={query.status ?? ""}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Усі статуси</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {ORDER_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-56 flex-col gap-2">
              <Label htmlFor="customerId">Клієнт</Label>
              <select
                id="customerId"
                name="customerId"
                defaultValue={query.customerId ?? ""}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Усі клієнти</option>
                {customers.items.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} · {customer.phone}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm font-medium hover:bg-muted"
            >
              Застосувати
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0">
          {result.items.length === 0 ? (
            <p className="px-6 py-8 text-center text-muted-foreground">Замовлень не знайдено.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="px-6 py-2 font-medium">№</th>
                    <th className="px-6 py-2 font-medium">Дата</th>
                    <th className="px-6 py-2 font-medium">Клієнт</th>
                    <th className="px-6 py-2 font-medium">Статус</th>
                    <th className="px-6 py-2 text-right font-medium">Позицій</th>
                    <th className="px-6 py-2 text-right font-medium">Сума</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((order) => (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="px-6 py-2">
                        <Link href={`/orders/${order.id}`} className="font-medium hover:underline">
                          {order.number}
                        </Link>
                      </td>
                      <td className="px-6 py-2 text-muted-foreground">
                        {dateTimeFormatter.format(order.createdAt)}
                      </td>
                      <td className="px-6 py-2">
                        <Link href={`/customers/${order.customerId}`} className="hover:underline">
                          {order.customerName}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {order.customerPhone}
                        </span>
                      </td>
                      <td className="px-6 py-2">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-6 py-2 text-right">{order.itemsCount}</td>
                      <td className="px-6 py-2 text-right font-medium">
                        {formatKopecks(order.totalKopecks)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination query={query} totalPages={result.totalPages} />
    </section>
  );
}

function Pagination({ query, totalPages }: { query: OrderListQuery; totalPages: number }) {
  const link = (page: number) => {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    if (query.customerId) params.set("customerId", query.customerId);
    params.set("page", String(page));
    return `/orders?${params.toString()}`;
  };

  return (
    <nav className="flex items-center justify-between text-sm">
      {query.page > 1 ? (
        <Link href={link(query.page - 1)} className="hover:underline">
          ← Назад
        </Link>
      ) : (
        <span />
      )}

      <span className="text-muted-foreground">
        Сторінка {query.page} з {totalPages}
      </span>

      {query.page < totalPages ? (
        <Link href={link(query.page + 1)} className="hover:underline">
          Далі →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
