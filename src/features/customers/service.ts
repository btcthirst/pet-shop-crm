import { Prisma } from "@/generated/prisma/client";

import type { OrderStatus } from "@/generated/prisma/enums";
import type { CustomerInput, CustomerListQuery, CustomerPatch } from "@/features/customers/schema";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  ordersCount: number;
  createdAt: Date;
};

export type CustomerListResult = {
  items: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CustomerOrderSummary = {
  id: string;
  number: number;
  status: OrderStatus;
  totalKopecks: number;
  createdAt: Date;
};

export type CustomerCard = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: Date;
  orders: CustomerOrderSummary[];
};

const customerSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  notes: true,
  createdAt: true,
} as const;

/**
 * `phone` is the only business unique key on Customer, so a P2002 can only mean a
 * duplicated phone number.
 */
function translateWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError("VALIDATION_ERROR", "Такий телефон уже зареєстрований", {
        field: "phone",
      });
    }

    if (error.code === "P2025") {
      throw new AppError("NOT_FOUND", "Клієнта не знайдено");
    }
  }

  throw error;
}

export async function listCustomers(query: CustomerListQuery): Promise<CustomerListResult> {
  const where = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: "insensitive" as const } },
          { phone: { contains: query.q } },
        ],
      }
    : {};

  const [customers, total] = await db.$transaction([
    db.customer.findMany({
      where,
      orderBy: [{ name: "asc" }, { phone: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: { ...customerSelect, _count: { select: { orders: true } } },
    }),
    db.customer.count({ where }),
  ]);

  return {
    items: customers.map(({ _count, ...customer }) => ({
      ...customer,
      ordersCount: _count.orders,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Customer card with the order history the spec asks for (spec section 6.1). */
export async function getCustomer(id: string): Promise<CustomerCard> {
  const customer = await db.customer.findUnique({
    where: { id },
    select: {
      ...customerSelect,
      orders: {
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, status: true, totalKopecks: true, createdAt: true },
      },
    },
  });

  if (!customer) {
    throw new AppError("NOT_FOUND", "Клієнта не знайдено");
  }

  const { orders, ...rest } = customer;

  return { ...rest, orders };
}

export async function createCustomer(input: CustomerInput) {
  try {
    return await db.customer.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        notes: input.notes ?? null,
      },
      select: customerSelect,
    });
  } catch (error) {
    translateWriteError(error);
  }
}

export async function updateCustomer(id: string, patch: CustomerPatch) {
  try {
    return await db.customer.update({
      where: { id },
      data: {
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.phone === undefined ? {} : { phone: patch.phone }),
        ...(patch.email === undefined ? {} : { email: patch.email }),
        ...(patch.notes === undefined ? {} : { notes: patch.notes }),
      },
      select: customerSelect,
    });
  } catch (error) {
    translateWriteError(error);
  }
}

/** A customer with orders is never removed, only kept (spec section 5.4). */
export async function deleteCustomer(id: string): Promise<void> {
  const ordersCount = await db.order.count({ where: { customerId: id } });

  if (ordersCount > 0) {
    throw new AppError("VALIDATION_ERROR", "Клієнта не можна видалити, поки в нього є замовлення", {
      ordersCount,
    });
  }

  try {
    await db.customer.delete({ where: { id } });
  } catch (error) {
    translateWriteError(error);
  }
}
