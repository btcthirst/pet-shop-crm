import type { StockReason } from "@/generated/prisma/enums";

import type { StockMovementInput, StockMovementListQuery } from "@/features/stock/schema";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

export type StockMovementItem = {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  delta: number;
  reason: StockReason;
  note: string | null;
  orderId: string | null;
  createdByName: string;
  createdAt: Date;
};

export type StockMovementListResult = {
  items: StockMovementItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type StockMovementWithBalances = {
  movement: StockMovementItem;
  stockBefore: number;
  stockAfter: number;
};

/**
 * Applies one manual movement and writes the journal entry in the same transaction, so
 * `stock` can never move without a `StockMovement` (spec section 5.2).
 *
 * The balance is changed with a conditional update (`stock >= |delta|` for negative
 * deltas) exactly like order decrements, so parallel writes cannot push a product
 * below zero — the database CHECK is only the last line of defence.
 */
export async function createStockMovement(
  input: StockMovementInput,
  createdById: string,
): Promise<StockMovementWithBalances> {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: input.productId },
      select: { id: true, stock: true },
    });

    if (!product) {
      throw new AppError("NOT_FOUND", "Товар не знайдено");
    }

    const updated = await tx.product.updateMany({
      where:
        input.delta < 0
          ? { id: input.productId, stock: { gte: Math.abs(input.delta) } }
          : { id: input.productId },
      data: { stock: { increment: input.delta } },
    });

    if (updated.count === 0) {
      throw new AppError(
        "INSUFFICIENT_STOCK",
        `Недостатньо товару: доступно ${product.stock}, потрібно ${Math.abs(input.delta)}`,
        { field: "delta", available: product.stock, requested: Math.abs(input.delta) },
      );
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        delta: input.delta,
        reason: input.reason,
        note: input.note ? input.note : null,
        createdById,
      },
      include: {
        product: { select: { sku: true, name: true } },
        createdBy: { select: { name: true } },
      },
    });

    return {
      movement: toMovementItem(movement),
      stockBefore: product.stock,
      stockAfter: product.stock + input.delta,
    };
  });
}

export async function listStockMovements(
  query: StockMovementListQuery,
): Promise<StockMovementListResult> {
  const where = {
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.reason ? { reason: query.reason } : {}),
  };

  const [movements, total] = await db.$transaction([
    db.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        product: { select: { sku: true, name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    db.stockMovement.count({ where }),
  ]);

  return {
    items: movements.map(toMovementItem),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

type MovementRecord = {
  id: string;
  productId: string;
  delta: number;
  reason: StockReason;
  note: string | null;
  orderId: string | null;
  createdAt: Date;
  product: { sku: string; name: string };
  createdBy: { name: string };
};

function toMovementItem(record: MovementRecord): StockMovementItem {
  return {
    id: record.id,
    productId: record.productId,
    productSku: record.product.sku,
    productName: record.product.name,
    delta: record.delta,
    reason: record.reason,
    note: record.note,
    orderId: record.orderId,
    createdByName: record.createdBy.name,
    createdAt: record.createdAt,
  };
}
