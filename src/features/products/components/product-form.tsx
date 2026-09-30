"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { productFormSchema, type ProductFormValues } from "@/features/products/schema";
import type { ActionState } from "@/lib/action-state";

type CategoryOption = { id: string; name: string };

type ProductFormProps = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  categories: CategoryOption[];
  defaultValues?: ProductFormValues;
  submitLabel: string;
  hiddenId?: string;
};

export function ProductForm({
  action,
  categories,
  defaultValues,
  submitLabel,
  hiddenId,
}: ProductFormProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({});
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaultValues ?? {
      sku: "",
      name: "",
      description: "",
      price: "",
      categoryId: categories[0]?.id ?? "",
      lowStockThreshold: "5",
    },
  });

  // Client validation runs first, then the server answers with field-level errors.
  const fieldError = (field: keyof ProductFormValues) =>
    errors[field]?.message ?? state.fieldErrors?.[field];

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    if (hiddenId) formData.set("id", hiddenId);
    formData.set("sku", values.sku);
    formData.set("name", values.name);
    formData.set("description", values.description);
    formData.set("categoryId", values.categoryId);
    formData.set("lowStockThreshold", values.lowStockThreshold);
    formData.set("price", values.price);

    startTransition(async () => {
      const result = await action(state, formData);
      setState(result);

      if (result.error || result.fieldErrors) return;

      if (hiddenId) {
        setState({ createdId: hiddenId });
        return;
      }

      reset();
      if (result.createdId) router.push(`/products/${result.createdId}`);
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SKU" htmlFor="sku" error={fieldError("sku")}>
          <Input id="sku" aria-invalid={Boolean(fieldError("sku"))} {...register("sku")} />
        </Field>

        <Field label="Назва" htmlFor="name" error={fieldError("name")}>
          <Input id="name" aria-invalid={Boolean(fieldError("name"))} {...register("name")} />
        </Field>

        <Field label="Ціна, грн" htmlFor="price" error={fieldError("price")}>
          <Input
            id="price"
            inputMode="decimal"
            placeholder="249.90"
            aria-invalid={Boolean(fieldError("price"))}
            {...register("price")}
          />
        </Field>

        <Field label="Категорія" htmlFor="categoryId" error={fieldError("categoryId")}>
          <select
            id="categoryId"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-invalid={Boolean(fieldError("categoryId"))}
            {...register("categoryId")}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Поріг малого залишку"
          htmlFor="lowStockThreshold"
          error={fieldError("lowStockThreshold")}
        >
          <Input
            id="lowStockThreshold"
            inputMode="numeric"
            aria-invalid={Boolean(fieldError("lowStockThreshold"))}
            {...register("lowStockThreshold")}
          />
        </Field>
      </div>

      <Field label="Опис" htmlFor="description" error={fieldError("description")}>
        <textarea
          id="description"
          rows={3}
          className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          {...register("description")}
        />
      </Field>

      {/* Field-level errors already point at the input, so the summary is only for
          errors without a field (e.g. permission or a database rule). */}
      {state.error && !Object.keys(state.fieldErrors ?? {}).length ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {hiddenId && !state.error && state.createdId ? (
        <p className="text-sm text-muted-foreground">Зміни збережено.</p>
      ) : null}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Зберігаємо…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
