"use client";

import { useTransition } from "react";

import { signOutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <form action={() => startTransition(() => signOutAction())} className="flex items-center gap-2">
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Виходимо…" : "Вийти"}
      </Button>
    </form>
  );
}
