import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboard } from "@/features/dashboard/service";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { formatKopecks } from "@/lib/money";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Дашборд" };

const dateTimeFormatter = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const dashboard = await getDashboard();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Вітаємо, {user.name}</h1>
        <p className="text-muted-foreground">
          Роль: {user.role === "ADMIN" ? "Admin" : "Manager"}. Нові замовлення та товари з малим
          залишком.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Нові замовлення</CardTitle>
            <CardDescription>Нові та підтверджені, ще не завершені</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{dashboard.newOrders.count}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Малий залишок</CardTitle>
            <CardDescription>Активні товари, де залишок ≤ порогу</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{dashboard.lowStock.count}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Останні замовлення</CardTitle>
          <CardDescription>Показані перші 10</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {dashboard.newOrders.items.length === 0 ? (
            <p className="px-6 py-8 text-center text-muted-foreground">
              Нових замовлень немає — усі завершені або ще не створювали.
            </p>
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
                  {dashboard.newOrders.items.map((order) => (
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

      <Card>
        <CardHeader>
          <CardTitle>Товари з малим залишком</CardTitle>
          <CardDescription>Активні товари, де stock ≤ lowStockThreshold</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {dashboard.lowStock.items.length === 0 ? (
            <p className="px-6 py-8 text-center text-muted-foreground">
              Усі активні товари мають достатній залишок.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="px-6 py-2 font-medium">SKU</th>
                    <th className="px-6 py-2 font-medium">Назва</th>
                    <th className="px-6 py-2 text-right font-medium">Залишок</th>
                    <th className="px-6 py-2 text-right font-medium">Поріг</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.lowStock.items.map((product) => (
                    <tr key={product.id} className="border-b last:border-0">
                      <td className="px-6 py-2 font-mono text-xs">
                        <Link href={`/products/${product.id}`} className="hover:underline">
                          {product.sku}
                        </Link>
                      </td>
                      <td className="px-6 py-2">
                        <Link href={`/products/${product.id}`} className="hover:underline">
                          {product.name}
                        </Link>
                      </td>
                      <td className="px-6 py-2 text-right font-medium">{product.stock}</td>
                      <td className="px-6 py-2 text-right text-muted-foreground">
                        {product.lowStockThreshold}
                      </td>
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
