import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseProductListQuery, type ProductListQuery } from "@/features/products/schema";
import { listProducts } from "@/features/products/service";
import { createStockMovementAction } from "@/features/stock/actions";
import { StockMovementForm } from "@/features/stock/components/stock-movement-form";
import {
  STOCK_REASON_LABELS,
  parseStockMovementListQuery,
  type StockMovementListQuery,
} from "@/features/stock/schema";
import { listStockMovements } from "@/features/stock/service";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Склад" };

type StockPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function StockPage({ searchParams }: StockPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  // Both tables paginate independently, hence the prefixed page parameters.
  const balancesQuery = parseProductListQuery({ ...params, page: params.balancesPage });
  const movementQuery = parseStockMovementListQuery({ ...params, page: params.movementPage });

  const [balances, movements, selectable] = await Promise.all([
    listProducts({ ...balancesQuery, pageSize: 50 }),
    listStockMovements(movementQuery),
    // Every product can receive goods, so the form offers the full catalogue.
    listProducts({ page: 1, pageSize: 100, lowStock: false }),
  ]);

  const canCorrect = user.role === "ADMIN";

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Склад</h1>
        <p className="text-muted-foreground">
          Прихід доступний Admin і Manager, коригування залишку — лише Admin. Кожна зміна потрапляє
          в журнал рухів.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Прихід або коригування</CardTitle>
        </CardHeader>
        <CardContent>
          <StockMovementForm
            action={createStockMovementAction}
            products={selectable.items.map((product) => ({
              id: product.id,
              sku: product.sku,
              name: product.name,
              stock: product.stock,
            }))}
            canCorrect={canCorrect}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Залишки</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3 pb-4">
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <Label htmlFor="q">Пошук</Label>
              <Input
                id="q"
                name="q"
                defaultValue={balancesQuery.q ?? ""}
                placeholder="Назва або SKU"
              />
            </div>

            <label className="flex h-8 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="lowStock"
                value="true"
                defaultChecked={balancesQuery.lowStock}
                className="size-4 accent-primary"
              />
              Лише малі залишки
            </label>

            <button
              type="submit"
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm font-medium hover:bg-muted"
            >
              Застосувати
            </button>
          </form>

          {balances.items.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Товарів немає.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">SKU</th>
                    <th className="px-2 py-2 font-medium">Товар</th>
                    <th className="px-2 py-2 text-right font-medium">Залишок</th>
                    <th className="px-2 py-2 text-right font-medium">Поріг</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.items.map((product) => (
                    <tr key={product.id} className="border-b last:border-0">
                      <td className="px-2 py-2 font-mono text-xs">{product.sku}</td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/products/${product.id}`}
                          className="font-medium hover:underline"
                        >
                          {product.name}
                        </Link>
                        {!product.isActive ? (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            неактивний
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {product.isLowStock ? (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                            {product.stock}
                          </span>
                        ) : (
                          product.stock
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
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

      <BalancesPagination
        query={balancesQuery}
        totalPages={balances.totalPages}
        total={balances.total}
      />

      <Card>
        <CardHeader>
          <CardTitle>Журнал рухів</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3 pb-4">
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <Label htmlFor="productId">Товар</Label>
              <select
                id="productId"
                name="productId"
                defaultValue={movementQuery.productId ?? ""}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Усі товари</option>
                {selectable.items.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} — {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reason">Причина</Label>
              <select
                id="reason"
                name="reason"
                defaultValue={movementQuery.reason ?? ""}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Усі</option>
                {Object.entries(STOCK_REASON_LABELS).map(([reason, label]) => (
                  <option key={reason} value={reason}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm font-medium hover:bg-muted"
            >
              Застосувати
            </button>
          </form>

          {movements.items.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Рухів поки немає.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Дата</th>
                    <th className="px-2 py-2 font-medium">Товар</th>
                    <th className="px-2 py-2 text-right font-medium">Δ</th>
                    <th className="px-2 py-2 font-medium">Причина</th>
                    <th className="px-2 py-2 font-medium">Нотатка</th>
                    <th className="px-2 py-2 font-medium">Хто</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.items.map((movement) => (
                    <tr key={movement.id} className="border-b last:border-0">
                      <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">
                        {dateTimeFormatter.format(movement.createdAt)}
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/products/${movement.productId}`}
                          className="font-medium hover:underline"
                        >
                          {movement.productName}
                        </Link>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {movement.productSku}
                        </span>
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-medium ${
                          movement.delta > 0 ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                      </td>
                      <td className="px-2 py-2">{STOCK_REASON_LABELS[movement.reason]}</td>
                      <td className="px-2 py-2 text-muted-foreground">{movement.note ?? "—"}</td>
                      <td className="px-2 py-2 text-muted-foreground">{movement.createdByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <JournalPagination
        query={movementQuery}
        totalPages={movements.totalPages}
        total={movements.total}
      />
    </section>
  );
}

function BalancesPagination({
  query,
  totalPages,
  total,
}: {
  query: ProductListQuery;
  totalPages: number;
  total: number;
}) {
  const link = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.lowStock) params.set("lowStock", "true");
    params.set("balancesPage", String(page));
    return `/stock?${params.toString()}`;
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
        Залишків: {total} · сторінка {query.page} з {totalPages}
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

function JournalPagination({
  query,
  totalPages,
  total,
}: {
  query: StockMovementListQuery;
  totalPages: number;
  total: number;
}) {
  const link = (page: number) => {
    const params = new URLSearchParams();
    if (query.productId) params.set("productId", query.productId);
    if (query.reason) params.set("reason", query.reason);
    params.set("movementPage", String(page));
    return `/stock?${params.toString()}`;
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
        Рухів: {total} · сторінка {query.page} з {totalPages}
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
