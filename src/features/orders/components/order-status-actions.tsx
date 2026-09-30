"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { changeOrderStatusAction } from "@/features/orders/actions";
import { ORDER_STATUS_LABELS } from "@/features/orders/status";

import type { OrderStatus } from "@/generated/prisma/enums";

type OrderStatusActionsProps = {
  orderId: string;
  transitions: OrderStatus[];
};

/**
 * Only the transitions `status.ts` allows are rendered, and the action re-checks them
 * server-side: hiding a button is convenience, not the rule.
 */
export function OrderStatusActions({ orderId, transitions }: OrderStatusActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (transitions.length === 0) {
    return <p className="text-sm text-muted-foreground">Замовлення у фінальному статусі.</p>;
  }

  const change = (toStatus: OrderStatus) =>
    startTransition(async () => {
      setError(null);
      try {
        await changeOrderStatusAction(orderId, toStatus);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Не вдалося змінити статус");
      }
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {transitions.map((toStatus) => (
          <Button
            key={toStatus}
            type="button"
            size="sm"
            variant={toStatus === "CANCELLED" ? "destructive" : "default"}
            disabled={isPending}
            onClick={() => change(toStatus)}
          >
            {isPending ? "Оновлюємо…" : ORDER_STATUS_LABELS[toStatus]}
          </Button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
