import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCategoryAction } from "@/features/categories/actions";
import { CategoryForm } from "@/features/categories/components/category-form";
import { CategoryRow } from "@/features/categories/components/category-row";
import { listCategories } from "@/features/categories/service";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Категорії" };

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const categories = await listCategories();
  const isAdmin = user.role === "ADMIN";

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Категорії</h1>
        <p className="text-muted-foreground">
          Категорію, у якій є товари, видалити не можна — лише перейменувати.
        </p>
      </div>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Нова категорія</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryForm id="category-new" action={createCategoryAction} submitLabel="Додати" />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="px-0">
          {categories.length === 0 ? (
            <p className="px-6 py-8 text-center text-muted-foreground">Категорій ще немає.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="px-6 py-2 font-medium">Назва</th>
                    <th className="px-6 py-2 font-medium">Товарів</th>
                    {isAdmin ? <th className="px-6 py-2 font-medium">Дії</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) =>
                    isAdmin ? (
                      <CategoryRow
                        key={category.id}
                        id={category.id}
                        name={category.name}
                        productsCount={category.productsCount}
                      />
                    ) : (
                      <tr key={category.id} className="border-b last:border-0">
                        <td className="px-6 py-2 font-medium">{category.name}</td>
                        <td className="px-6 py-2 text-muted-foreground">
                          {category.productsCount}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
