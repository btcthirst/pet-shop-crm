import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listCategories } from "@/features/categories/service";
import { parseProductListQuery, type ProductListQuery } from "@/features/products/schema";
import { listProducts } from "@/features/products/service";
import { formatKopecks } from "@/lib/money";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Товари" };

type ProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const query = parseProductListQuery(await searchParams);
  const [result, categories] = await Promise.all([listProducts(query), listCategories()]);
  const isAdmin = user.role === "ADMIN";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Товари</h1>
          <p className="text-muted-foreground">
            Знайдено {result.total} · сторінка {result.page} з {result.totalPages}
          </p>
        </div>

        {isAdmin ? (
          <ButtonLink href="/products/new">Новий товар</ButtonLink>
        ) : (
          <p className="text-sm text-muted-foreground">Перегляд доступний без змін</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Пошук і фільтри</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <Label htmlFor="q">Пошук</Label>
              <Input id="q" name="q" defaultValue={query.q ?? ""} placeholder="Назва або SKU" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="categoryId">Категорія</Label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={query.categoryId ?? ""}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Усі категорії</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex h-8 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="lowStock"
                value="true"
                defaultChecked={query.lowStock}
                className="size-4 accent-primary"
              />
              Малий залишок
            </label>

            <button
              type="submit"
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm font-medium hover:bg-muted"
            >
              Застосувати
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0">
          {result.items.length === 0 ? (
            <p className="px-6 py-8 text-center text-muted-foreground">
              Товарів за цими фільтрами немає.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="px-6 py-2 font-medium">SKU</th>
                    <th className="px-6 py-2 font-medium">Назва</th>
                    <th className="px-6 py-2 font-medium">Категорія</th>
                    <th className="px-6 py-2 text-right font-medium">Ціна</th>
                    <th className="px-6 py-2 text-right font-medium">Залишок</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((product) => (
                    <tr key={product.id} className="border-b last:border-0">
                      <td className="px-6 py-2 font-mono text-xs">{product.sku}</td>
                      <td className="px-6 py-2">
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
                      <td className="px-6 py-2 text-muted-foreground">{product.categoryName}</td>
                      <td className="px-6 py-2 text-right">
                        {formatKopecks(product.priceKopecks)}
                      </td>
                      <td className="px-6 py-2 text-right">
                        <span className={product.isLowStock ? "text-destructive" : undefined}>
                          {product.stock}
                        </span>
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

function Pagination({ query, totalPages }: { query: ProductListQuery; totalPages: number }) {
  const link = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.categoryId) params.set("categoryId", query.categoryId);
    if (query.lowStock) params.set("lowStock", "true");
    params.set("page", String(page));
    return `/products?${params.toString()}`;
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

function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
    >
      {children}
    </Link>
  );
}
