import type { OrderStatus } from "@/generated/prisma/enums";

/** UI labels for the order statuses of spec section 5.1. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Нове",
  CONFIRMED: "Підтверджено",
  SHIPPED: "Відправлено",
  DELIVERED: "Доставлено",
  CANCELLED: "Скасовано",
};
