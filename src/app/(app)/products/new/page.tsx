import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCategories } from "@/features/categories/service";
import { createProductAction } from "@/features/products/actions";
import { ProductForm } from "@/features/products/components/product-form";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Новий товар" };

export default async function NewProductPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // The form is for Admin only; the action re-checks the permission anyway.
  if (user.role !== "ADMIN") {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Доступ заборонено</h1>
        <p className="text-muted-foreground">Створювати товари може лише Admin.</p>
      </section>
    );
  }

  const categories = await listCategories();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Новий товар</h1>
        <p className="text-muted-foreground">Ціна вводиться у гривнях, зберігається у копійках.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Дані товару</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Спершу створіть категорію на сторінці «Категорії».
            </p>
          ) : (
            <ProductForm
              action={createProductAction}
              categories={categories}
              submitLabel="Створити товар"
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
