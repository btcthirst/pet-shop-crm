"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MANUAL_STOCK_REASONS,
  STOCK_REASON_LABELS,
  stockMovementFormSchema,
  type StockMovementFormValues,
} from "@/features/stock/schema";

import type { ActionState } from "@/lib/action-state";

type ProductOption = { id: string; sku: string; name: string; stock: number };

type StockMovementFormProps = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  products: ProductOption[];
  /** Manager may only receive goods, so the reason select is limited for that role. */
  canCorrect: boolean;
};

export function StockMovementForm({ action, products, canCorrect }: StockMovementFormProps) {
  const [state, setState] = useState<ActionState>({});
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StockMovementFormValues>({
    resolver: zodResolver(stockMovementFormSchema),
    defaultValues: {
      productId: products[0]?.id ?? "",
      delta: "",
      reason: "RESTOCK",
      note: "",
    },
  });

  const fieldError = (field: "productId" | "delta" | "reason" | "note") =>
    errors[field]?.message ?? state.fieldErrors?.[field];

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    formData.set("productId", values.productId);
    formData.set("delta", values.delta);
    formData.set("reason", values.reason);
    formData.set("note", values.note);

    startTransition(async () => {
      const result = await action(state, formData);
      setState(result);
      if (!result.error && !result.fieldErrors) reset({ ...values, delta: "", note: "" });
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="stockProductId">Товар</Label>
          <select
            id="stockProductId"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-invalid={Boolean(fieldError("productId"))}
            {...register("productId")}
          >
            {products.length === 0 ? <option value="">Немає товарів</option> : null}
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} — {product.name} (залишок {product.stock})
              </option>
            ))}
          </select>
          {fieldError("productId") ? (
            <p className="text-sm text-destructive">{fieldError("productId")}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="stockDelta">Кількість (+ прихід, − списання)</Label>
          <Input
            id="stockDelta"
            inputMode="numeric"
            placeholder="10"
            aria-invalid={Boolean(fieldError("delta"))}
            {...register("delta")}
          />
          {fieldError("delta") ? (
            <p className="text-sm text-destructive">{fieldError("delta")}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="stockReason">Причина руху</Label>
          <select
            id="stockReason"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-invalid={Boolean(fieldError("reason"))}
            {...register("reason")}
          >
            {MANUAL_STOCK_REASONS.filter((reason) => canCorrect || reason === "RESTOCK").map(
              (reason) => (
                <option key={reason} value={reason}>
                  {STOCK_REASON_LABELS[reason]}
                </option>
              ),
            )}
          </select>
          {fieldError("reason") ? (
            <p className="text-sm text-destructive">{fieldError("reason")}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="stockNote">Нотатка</Label>
          <Input id="stockNote" placeholder="Постачальник, номер документа" {...register("note")} />
          {fieldError("note") ? (
            <p className="text-sm text-destructive">{fieldError("note")}</p>
          ) : null}
        </div>
      </div>

      {state.error && !Object.keys(state.fieldErrors ?? {}).length ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {state.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}

      <Button type="submit" disabled={isPending || products.length === 0} className="self-start">
        {isPending ? "Зберігаємо…" : "Записати рух"}
      </Button>
    </form>
  );
}
