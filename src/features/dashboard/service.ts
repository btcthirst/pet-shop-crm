import { Prisma } from "@/generated/prisma/client";

import type { OrderStatus } from "@/generated/prisma/enums";

import { db } from "@/lib/db";

/** Orders that still need work: neither delivered nor cancelled. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = ["NEW", "CONFIRMED"];

export type DashboardOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  totalKopecks: number;
  itemsCount: number;
  createdAt: Date;
  customerId: string;
  customerName: string;
  customerPhone: string;
};

export type DashboardProduct = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
};

export type DashboardData = {
  newOrders: { count: number; items: DashboardOrder[] };
  lowStock: { count: number; items: DashboardProduct[] };
};

type LowStockRow = DashboardProduct;

const DEFAULT_LIMIT = 10;

/**
 * Dashboard data (spec section 6.1). Both blocks answer the same questions as the
 * catalogue and the order list, but only what the screen shows: counts plus the first rows.
 */
export async function getDashboard(limit: number = DEFAULT_LIMIT): Promise<DashboardData> {
  const openOrders = { status: { in: OPEN_ORDER_STATUSES } };

  const [orders, ordersCount, lowStockRows, lowStockCount] = await db.$transaction([
    db.order.findMany({
      where: openOrders,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        number: true,
        status: true,
        totalKopecks: true,
        createdAt: true,
        customerId: true,
        customer: { select: { name: true, phone: true } },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where: openOrders }),
    // Same `stock <= lowStockThreshold` rule as the catalogue, but only active products:
    // a deactivated product is not waiting for a restock, so it must not raise an alarm.
    db.$queryRaw<LowStockRow[]>(Prisma.sql`
      SELECT id, sku, name, stock, "lowStockThreshold"
      FROM "Product"
      WHERE "isActive" AND stock <= "lowStockThreshold"
      ORDER BY stock ASC, name ASC
      LIMIT ${limit}
    `),
    db.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "Product"
      WHERE "isActive" AND stock <= "lowStockThreshold"
    `),
  ]);

  return {
    newOrders: {
      count: ordersCount,
      items: orders.map(({ _count, customer, ...order }) => ({
        ...order,
        itemsCount: _count.items,
        customerName: customer.name,
        customerPhone: customer.phone,
      })),
    },
    lowStock: { count: Number(lowStockCount[0]?.count ?? 0), items: lowStockRows },
  };
}
