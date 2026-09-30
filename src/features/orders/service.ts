import { Prisma } from "@/generated/prisma/client";

import type { OrderStatus } from "@/generated/prisma/enums";
import type { OrderInput, OrderListQuery } from "@/features/orders/schema";
import { canTransition } from "@/features/orders/status";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { sumOrderItems } from "@/lib/money";

export type OrderListItem = {
  id: string;
  number: number;
  status: OrderStatus;
  totalKopecks: number;
  itemsCount: number;
  createdAt: Date;
  customerId: string;
  customerName: string;
  customerPhone: string;
  createdByName: string;
};

export type OrderListResult = {
  items: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type OrderLine = {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPriceKopecks: number;
  lineTotalKopecks: number;
};

export type OrderStatusEntry = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedByName: string;
  changedAt: Date;
};

export type OrderDetail = {
  id: string;
  number: number;
  status: OrderStatus;
  totalKopecks: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { id: string; name: string; phone: string; email: string | null };
  createdByName: string;
  items: OrderLine[];
  history: OrderStatusEntry[];
};

const orderDetailSelect = {
  id: true,
  number: true,
  status: true,
  totalKopecks: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true, phone: true, email: true } },
  createdBy: { select: { name: true } },
  items: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      unitPriceKopecks: true,
      product: { select: { sku: true, name: true } },
    },
  },
  history: {
    orderBy: { changedAt: "asc" },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      changedAt: true,
      changedBy: { select: { name: true } },
    },
  },
} satisfies Prisma.OrderSelect;

type OrderDetailRecord = Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>;

function toOrderDetail(record: OrderDetailRecord): OrderDetail {
  return {
    id: record.id,
    number: record.number,
    status: record.status,
    totalKopecks: record.totalKopecks,
    comment: record.comment,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    customer: record.customer,
    createdByName: record.createdBy.name,
    items: record.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productSku: item.product.sku,
      productName: item.product.name,
      quantity: item.quantity,
      unitPriceKopecks: item.unitPriceKopecks,
      lineTotalKopecks: item.quantity * item.unitPriceKopecks,
    })),
    history: record.history.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      changedByName: entry.changedBy.name,
      changedAt: entry.changedAt,
    })),
  };
}

/**
 * Creates an order and writes the stock movements in one transaction (spec section 5.2):
 * stock is decremented with a conditional update, so two parallel orders for the last
 * unit cannot both succeed, and a failure rolls the whole order back.
 *
 * `unitPriceKopecks` is copied from the product and `totalKopecks` is computed on the
 * server, so a client cannot dictate prices or totals (spec section 5.3).
 */
export async function createOrder(input: OrderInput, createdById: string): Promise<OrderDetail> {
  const productIds = input.items.map((item) => item.productId);

  return db.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sku: true, name: true, priceKopecks: true, stock: true, isActive: true },
    });

    if (products.length !== productIds.length) {
      const found = new Set(products.map((product) => product.id));
      throw new AppError("NOT_FOUND", "Товар не знайдено", {
        productId: productIds.find((id) => !found.has(id)),
      });
    }

    const inactive = products.filter((product) => !product.isActive);
    if (inactive.length > 0) {
      throw new AppError("VALIDATION_ERROR", "Деактивовані товари не можна замовляти", {
        productIds: inactive.map((product) => product.id),
      });
    }

    const byId = new Map(products.map((product) => [product.id, product]));
    const lines = input.items.map((item) => {
      const product = byId.get(item.productId)!;
      return { ...item, unitPriceKopecks: product.priceKopecks };
    });

    const customer = await tx.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true },
    });

    if (!customer) {
      throw new AppError("NOT_FOUND", "Клієнта не знайдено", { field: "customerId" });
    }

    for (const line of lines) {
      const updated = await tx.product.updateMany({
        where: { id: line.productId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });

      if (updated.count === 0) {
        const product = byId.get(line.productId)!;
        throw new AppError(
          "INSUFFICIENT_STOCK",
          `Недостатньо товару «${product.name}»: доступно ${product.stock}, потрібно ${line.quantity}`,
          {
            productId: product.id,
            sku: product.sku,
            available: product.stock,
            requested: line.quantity,
          },
        );
      }
    }

    const order = await tx.order.create({
      data: {
        customerId: input.customerId,
        createdById,
        totalKopecks: sumOrderItems(lines),
        comment: input.comment ?? null,
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPriceKopecks: line.unitPriceKopecks,
          })),
        },
        history: {
          create: { fromStatus: null, toStatus: "NEW", changedById: createdById },
        },
      },
      select: { id: true, number: true },
    });

    for (const line of lines) {
      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          delta: -line.quantity,
          reason: "ORDER",
          orderId: order.id,
          note: `Замовлення №${order.number}`,
          createdById,
        },
      });
    }

    return getOrderInTransaction(tx, order.id);
  });
}

/**
 * Moves an order to the next status. Cancelling puts every line back into stock with a
 * `CANCEL` movement; the status change and its history entry share the transaction, so
 * stock and history can never disagree (spec sections 5.1 and 5.2).
 */
export async function changeOrderStatus(
  id: string,
  toStatus: OrderStatus,
  changedById: string,
): Promise<OrderDetail> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    if (!order) {
      throw new AppError("NOT_FOUND", "Замовлення не знайдено");
    }

    if (!canTransition(order.status, toStatus)) {
      throw new AppError("INVALID_TRANSITION", "Такий перехід статусу неможливий", {
        fromStatus: order.status,
        toStatus,
      });
    }

    if (toStatus === "CANCELLED") {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            delta: item.quantity,
            reason: "CANCEL",
            orderId: order.id,
            note: `Скасування №${order.number}`,
            createdById: changedById,
          },
        });
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: toStatus },
    });

    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus, changedById },
    });

    return getOrderInTransaction(tx, order.id);
  });
}

async function getOrderInTransaction(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<OrderDetail> {
  const order = await tx.order.findUnique({ where: { id }, select: orderDetailSelect });
  return toOrderDetail(mustFindOrder(order));
}

export async function getOrder(id: string): Promise<OrderDetail> {
  const order = await db.order.findUnique({ where: { id }, select: orderDetailSelect });
  return toOrderDetail(mustFindOrder(order));
}

function mustFindOrder(order: OrderDetailRecord | null): OrderDetailRecord {
  if (!order) {
    throw new AppError("NOT_FOUND", "Замовлення не знайдено");
  }

  return order;
}

export async function listOrders(query: OrderListQuery): Promise<OrderListResult> {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
  };

  const [orders, total] = await db.$transaction([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        number: true,
        status: true,
        totalKopecks: true,
        createdAt: true,
        customerId: true,
        customer: { select: { name: true, phone: true } },
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ]);

  return {
    items: orders.map(({ _count, customer, createdBy, ...order }) => ({
      ...order,
      itemsCount: _count.items,
      customerName: customer.name,
      customerPhone: customer.phone,
      createdByName: createdBy.name,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
