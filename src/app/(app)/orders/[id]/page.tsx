import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusActions } from "@/features/orders/components/order-status-actions";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { getOrder } from "@/features/orders/service";
import { allowedTransitions, ORDER_STATUS_LABELS } from "@/features/orders/status";
import { isAppError } from "@/lib/errors";
import { formatKopecks } from "@/lib/money";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Замовлення" };

const dateTimeFormatter = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "medium",
  timeStyle: "short",
});

type OrderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderPage({ params }: OrderPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  let order: Awaited<ReturnType<typeof getOrder>>;
  try {
    order = await getOrder(id);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold">
            Замовлення №{order.number}
            <OrderStatusBadge status={order.status} />
          </h1>
          <p className="text-muted-foreground">
            {dateTimeFormatter.format(order.createdAt)} · створив {order.createdByName}
          </p>
        </div>

        <Link href="/orders" className="text-sm hover:underline">
          ← До списку
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Позиції</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="px-6 py-2 font-medium">Товар</th>
                    <th className="px-6 py-2 text-right font-medium">К-сть</th>
                    <th className="px-6 py-2 text-right font-medium">Ціна</th>
                    <th className="px-6 py-2 text-right font-medium">Сума</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-6 py-2">
                        <Link
                          href={`/products/${item.productId}`}
                          className="font-medium hover:underline"
                        >
                          {item.productName}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {item.productSku}
                        </span>
                      </td>
                      <td className="px-6 py-2 text-right">{item.quantity}</td>
                      <td className="px-6 py-2 text-right">
                        {formatKopecks(item.unitPriceKopecks)}
                      </td>
                      <td className="px-6 py-2 text-right font-medium">
                        {formatKopecks(item.lineTotalKopecks)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t">
                  <tr>
                    <td className="px-6 py-2 font-medium" colSpan={3}>
                      Разом
                    </td>
                    <td className="px-6 py-2 text-right text-base font-semibold">
                      {formatKopecks(order.totalKopecks)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {order.comment ? (
              <p className="border-t px-6 py-3 text-sm text-muted-foreground">
                Коментар: {order.comment}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Клієнт</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <Link
                href={`/customers/${order.customer.id}`}
                className="font-medium hover:underline"
              >
                {order.customer.name}
              </Link>
              <p className="font-mono text-xs text-muted-foreground">{order.customer.phone}</p>
              {order.customer.email ? (
                <p className="text-muted-foreground">{order.customer.email}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Статус</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <OrderStatusActions
                orderId={order.id}
                transitions={allowedTransitions(order.status)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Історія статусів</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3 text-sm">
                {order.history.map((entry) => (
                  <li key={entry.id} className="flex flex-col">
                    <span className="font-medium">
                      {entry.fromStatus ? `${ORDER_STATUS_LABELS[entry.fromStatus]} → ` : ""}
                      {ORDER_STATUS_LABELS[entry.toStatus]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {dateTimeFormatter.format(entry.changedAt)} · {entry.changedByName}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
