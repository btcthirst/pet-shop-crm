"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { setProductActiveAction } from "@/features/products/actions";

type ToggleActiveButtonProps = {
  productId: string;
  isActive: boolean;
};

/** Deactivation replaces deletion (spec section 5.4); the action re-checks permission. */
export function ToggleActiveButton({ productId, isActive }: ToggleActiveButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={isActive ? "destructive" : "outline"}
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await setProductActiveAction(productId, !isActive);
        })
      }
    >
      {isActive ? "Деактивувати" : "Активувати"}
    </Button>
  );
}
