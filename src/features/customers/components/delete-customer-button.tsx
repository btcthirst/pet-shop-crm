"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteCustomerAction } from "@/features/customers/actions";

type DeleteCustomerButtonProps = {
  customerId: string;
};

/** Deletion is Admin only and refused by the action when the customer has orders. */
export function DeleteCustomerButton({ customerId }: DeleteCustomerButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await deleteCustomerAction(customerId);
              router.push("/customers");
              router.refresh();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Не вдалося видалити клієнта");
            }
          })
        }
      >
        {isPending ? "Видаляємо…" : "Видалити клієнта"}
      </Button>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
