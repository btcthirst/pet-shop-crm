import { ORDER_STATUS_LABELS } from "@/features/orders/status";

import type { OrderStatus } from "@/generated/prisma/enums";

const badgeClasses: Record<OrderStatus, string> = {
  NEW: "bg-muted text-muted-foreground",
  CONFIRMED: "bg-blue-100 text-blue-900",
  SHIPPED: "bg-amber-100 text-amber-900",
  DELIVERED: "bg-emerald-100 text-emerald-900",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClasses[status]}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
