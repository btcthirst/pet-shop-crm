"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CategoryForm } from "@/features/categories/components/category-form";
import { deleteCategoryAction } from "@/features/categories/actions";
import { renameCategoryAction } from "@/features/categories/actions";

type CategoryRowProps = {
  id: string;
  name: string;
  productsCount: number;
};

/** Admin-only row: rename via action, delete blocked server-side when products exist. */
export function CategoryRow({ id, name, productsCount }: CategoryRowProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr className="border-b last:border-0">
      <td className="px-6 py-2 font-medium">{name}</td>
      <td className="px-6 py-2 text-muted-foreground">{productsCount}</td>
      <td className="px-6 py-2">
        <div className="flex items-center gap-2">
          <CategoryForm
            id={`category-${id}`}
            action={renameCategoryAction.bind(null, id)}
            defaultName={name}
            submitLabel="Перейменувати"
          />

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending || productsCount > 0}
            title={productsCount > 0 ? "Категорію з товарами видалити не можна" : undefined}
            onClick={() =>
              startTransition(async () => {
                await deleteCategoryAction(id);
              })
            }
          >
            Видалити
          </Button>
        </div>
      </td>
    </tr>
  );
}
