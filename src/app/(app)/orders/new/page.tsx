import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderForm } from "@/features/orders/components/order-form";
import { listProducts } from "@/features/products/service";
import { listCustomers } from "@/features/customers/service";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Нове замовлення" };

export default async function NewOrderPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Only active products are offered (spec section 5.4); 100 rows covers the demo catalogue.
  const [products, customers] = await Promise.all([
    listProducts({ page: 1, pageSize: 100, lowStock: false }),
    listCustomers({ page: 1, pageSize: 100 }),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Нове замовлення</h1>
        <p className="text-muted-foreground">
          Залишки спишуться одразу під час створення; сума рахується на сервері.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Позиції замовлення</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderForm
            products={products.items.map((product) => ({
              id: product.id,
              sku: product.sku,
              name: product.name,
              priceKopecks: product.priceKopecks,
              stock: product.stock,
            }))}
            customers={customers.items.map((customer) => ({
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
            }))}
          />
        </CardContent>
      </Card>
    </section>
  );
}
