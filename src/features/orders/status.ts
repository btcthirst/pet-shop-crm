import type { OrderStatus } from "@/generated/prisma/enums";

/** UI labels for the order statuses of spec section 5.1. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Нове",
  CONFIRMED: "Підтверджено",
  SHIPPED: "Відправлено",
  DELIVERED: "Доставлено",
  CANCELLED: "Скасовано",
};

/**
 * The only place allowed order status transitions are defined (spec section 5.1).
 * Both the API and the UI read this map, so a button can never offer a move the
 * service would reject.
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Every status, in the order of the lifecycle. Used by filters and the status input. */
export const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

/** Statuses a user may pick on the order card right now. */
export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from];
}
