"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customerFormSchema, type CustomerFormValues } from "@/features/customers/schema";

import type { ActionState } from "@/lib/action-state";

type CustomerFormProps = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: CustomerFormValues;
  submitLabel: string;
  hiddenId?: string;
};

export function CustomerForm({ action, defaultValues, submitLabel, hiddenId }: CustomerFormProps) {
  const [state, setState] = useState<ActionState>({});
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: defaultValues ?? { name: "", phone: "", email: "", notes: "" },
  });

  const fieldError = (field: keyof CustomerFormValues) =>
    errors[field]?.message ?? state.fieldErrors?.[field];

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    if (hiddenId) formData.set("id", hiddenId);
    formData.set("name", values.name);
    formData.set("phone", values.phone);
    formData.set("email", values.email);
    formData.set("notes", values.notes);

    startTransition(async () => {
      const result = await action(state, formData);
      setState(result);
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ім'я" htmlFor="name" error={fieldError("name")}>
          <Input id="name" aria-invalid={Boolean(fieldError("name"))} {...register("name")} />
        </Field>

        <Field label="Телефон" htmlFor="phone" error={fieldError("phone")}>
          <Input
            id="phone"
            inputMode="tel"
            placeholder="+380501234567"
            aria-invalid={Boolean(fieldError("phone"))}
            {...register("phone")}
          />
        </Field>

        <Field label="Email" htmlFor="email" error={fieldError("email")}>
          <Input
            id="email"
            type="email"
            placeholder="client@example.com"
            aria-invalid={Boolean(fieldError("email"))}
            {...register("email")}
          />
        </Field>
      </div>

      <Field label="Нотатки" htmlFor="notes" error={fieldError("notes")}>
        <textarea
          id="notes"
          rows={3}
          className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          {...register("notes")}
        />
      </Field>

      {state.error && !Object.keys(state.fieldErrors ?? {}).length ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {state.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}

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
