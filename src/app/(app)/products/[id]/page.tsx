import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCategories } from "@/features/categories/service";
import { updateProductAction } from "@/features/products/actions";
import { ProductForm } from "@/features/products/components/product-form";
import { ToggleActiveButton } from "@/features/products/components/toggle-active-button";
import { getProduct } from "@/features/products/service";
import { isAppError } from "@/lib/errors";
import { formatKopecks } from "@/lib/money";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Картка товару" };

type ProductPageProps = { params: Promise<{ id: string }> };

export default async function ProductPage({ params }: ProductPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  let product: Awaited<ReturnType<typeof getProduct>>;
  try {
    product = await getProduct(id);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const categories = await listCategories();
  const isAdmin = user.role === "ADMIN";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/products" className="text-sm text-muted-foreground hover:underline">
            ← Каталог
          </Link>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="text-muted-foreground">
            {product.sku} · {product.category.name}
            {!product.isActive ? " · неактивний" : ""}
          </p>
        </div>

        {isAdmin ? <ToggleActiveButton productId={product.id} isActive={product.isActive} /> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Ціна" value={formatKopecks(product.priceKopecks)} />
        <SummaryCard label="Залишок" value={String(product.stock)} />
        <SummaryCard label="Поріг малого залишку" value={String(product.lowStockThreshold)} />
      </div>

      {product.description ? (
        <Card>
          <CardHeader>
            <CardTitle>Опис</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{product.description}</p>
          </CardContent>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Редагування</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductForm
              action={updateProductAction}
              categories={categories}
              hiddenId={product.id}
              submitLabel="Зберегти зміни"
              defaultValues={{
                sku: product.sku,
                name: product.name,
                description: product.description ?? "",
                categoryId: product.categoryId,
                lowStockThreshold: String(product.lowStockThreshold),
                price: (product.priceKopecks / 100).toFixed(2),
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Редагування доступне лише Admin. Зміна залишку робиться на сторінці «Склад».
        </p>
      )}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  );
}
