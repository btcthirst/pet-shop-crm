"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createOrderAction } from "@/features/orders/actions";
import { orderFormSchema, type OrderFormValues } from "@/features/orders/schema";
import { formatKopecks } from "@/lib/money";

import type { ActionState } from "@/lib/action-state";

export type OrderFormProduct = {
  id: string;
  sku: string;
  name: string;
  priceKopecks: number;
  stock: number;
};

export type OrderFormCustomer = {
  id: string;
  name: string;
  phone: string;
};

type OrderFormProps = {
  products: OrderFormProduct[];
  customers: OrderFormCustomer[];
};

export function OrderForm({ products, customers }: OrderFormProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({});
  const [isPending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: { customerId: "", comment: "", items: [{ productId: "", quantity: "1" }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });

  /** Client-side resolver errors first, then the messages the action returned. */
  const fieldError = (field: string, clientMessage?: string) =>
    clientMessage ?? state.fieldErrors?.[field];

  const customerError = fieldError("customerId", errors.customerId?.message);
  const commentError = fieldError("comment", errors.comment?.message);

  const totalKopecks = (watchedItems ?? []).reduce((total, item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    const quantity = Number(item.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1) return total;
    return total + product.priceKopecks * quantity;
  }, 0);

  const itemError = errors.items;
  const clientItemsError =
    itemError && typeof itemError.message === "string" ? itemError.message : undefined;
  const serverItemsError = state.fieldErrors?.items;

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    formData.set("customerId", values.customerId);
    formData.set("comment", values.comment);
    values.items.forEach((item, index) => {
      formData.set(`items.${index}.productId`, item.productId);
      formData.set(`items.${index}.quantity`, item.quantity);
    });

    startTransition(async () => {
      const result = await createOrderAction(state, formData);
      setState(result);

      if (result.createdId) {
        router.push(`/orders/${result.createdId}`);
        router.refresh();
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="customerId">Клієнт</Label>
        <select
          id="customerId"
          aria-invalid={Boolean(customerError)}
          className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          {...register("customerId")}
        >
          <option value="">Оберіть клієнта…</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name} · {customer.phone}
            </option>
          ))}
        </select>
        {customerError ? <p className="text-sm text-destructive">{customerError}</p> : null}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Позиції</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ productId: "", quantity: "1" })}
          >
            <Plus /> Додати позицію
          </Button>
        </div>

        {fields.map((field, index) => {
          const selected = products.find(
            (product) => product.id === watchedItems?.[index]?.productId,
          );
          const productError = fieldError(`items.${index}.productId`, itemError?.[index]?.message);
          const quantityError = fieldError(`items.${index}.quantity`, itemError?.[index]?.message);

          return (
            <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
              <select
                aria-label={`Товар ${index + 1}`}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register(`items.${index}.productId`)}
              >
                <option value="">Оберіть товар…</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name} (залишок {product.stock})
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={1}
                step={1}
                aria-label={`Кількість ${index + 1}`}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register(`items.${index}.quantity`)}
              />

              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={`Видалити позицію ${index + 1}`}
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>

              {productError || quantityError ? (
                <p className="text-sm text-destructive sm:col-span-3">
                  {productError ?? quantityError}
                </p>
              ) : null}

              {selected && Number(watchedItems?.[index]?.quantity) > selected.stock ? (
                <p className="text-sm text-destructive sm:col-span-3">
                  На складі лише {selected.stock} шт. — замовлення буде відхилено сервером.
                </p>
              ) : null}
            </div>
          );
        })}

        {clientItemsError || serverItemsError ? (
          <p className="text-sm text-destructive">{clientItemsError ?? serverItemsError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="comment">Коментар</Label>
        <textarea
          id="comment"
          rows={2}
          className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          {...register("comment")}
        />
        {commentError ? <p className="text-sm text-destructive">{commentError}</p> : null}
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">
          Сума за позиціями:{" "}
          <span className="font-medium text-foreground">{formatKopecks(totalKopecks)}</span>
        </p>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Створюємо…" : "Створити замовлення"}
        </Button>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
