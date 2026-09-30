"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState, type ActionState } from "@/lib/action-state";

type CategoryFormProps = {
  /** `createCategoryAction` binds no id; the rename wrapper binds its own. */
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  defaultName?: string;
  submitLabel: string;
};

export function CategoryForm({ action, id, defaultName, submitLabel }: CategoryFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="flex min-w-40 flex-1 flex-col gap-2">
        <Label htmlFor={id} className="sr-only">
          Назва категорії
        </Label>
        <Input id={id} name="name" defaultValue={defaultName} placeholder="Назва категорії" />
      </div>

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "…" : submitLabel}
      </Button>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.fieldErrors?.name ?? state.error}
        </p>
      ) : null}
    </form>
  );
}
