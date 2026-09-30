"use client";

import { useEffect } from "react";

import { isAppError } from "@/lib/errors";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const forbidden = isAppError(error) && error.status === 403;

  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold">{forbidden ? "Доступ заборонено" : "Помилка"}</h1>
      <p className="text-muted-foreground">{error.message}</p>
      <button type="button" onClick={reset} className="underline">
        Спробувати ще раз
      </button>
    </div>
  );
}
