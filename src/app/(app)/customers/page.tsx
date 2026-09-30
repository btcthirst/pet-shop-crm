import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCustomerListQuery, type CustomerListQuery } from "@/features/customers/schema";
import { listCustomers } from "@/features/customers/service";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Клієнти" };

const dateFormatter = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" });

type CustomersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const query = parseCustomerListQuery(await searchParams);
  const result = await listCustomers(query);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Клієнти</h1>
          <p className="text-muted-foreground">
            Знайдено {result.total} · сторінка {result.page} з {result.totalPages}
          </p>
        </div>

        <Link
          href="/customers/new"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Новий клієнт
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Пошук</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <Label htmlFor="q">Ім&apos;я або телефон</Label>
              <Input id="q" name="q" defaultValue={query.q ?? ""} placeholder="Олена або +380" />
            </div>

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
              Клієнтів за цим пошуком немає.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="px-6 py-2 font-medium">Ім&apos;я</th>
                    <th className="px-6 py-2 font-medium">Телефон</th>
                    <th className="px-6 py-2 font-medium">Email</th>
                    <th className="px-6 py-2 text-right font-medium">Замовлень</th>
                    <th className="px-6 py-2 font-medium">Додано</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((customer) => (
                    <tr key={customer.id} className="border-b last:border-0">
                      <td className="px-6 py-2">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="font-medium hover:underline"
                        >
                          {customer.name}
                        </Link>
                      </td>
                      <td className="px-6 py-2 font-mono text-xs">{customer.phone}</td>
                      <td className="px-6 py-2 text-muted-foreground">{customer.email ?? "—"}</td>
                      <td className="px-6 py-2 text-right">{customer.ordersCount}</td>
                      <td className="px-6 py-2 text-muted-foreground">
                        {dateFormatter.format(customer.createdAt)}
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

function Pagination({ query, totalPages }: { query: CustomerListQuery; totalPages: number }) {
  const link = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    params.set("page", String(page));
    return `/customers?${params.toString()}`;
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
