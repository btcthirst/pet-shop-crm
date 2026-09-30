import { describe, expect, it } from "vitest";

import {
  orderFormSchema,
  orderInputSchema,
  orderStatusInputSchema,
  parseOrderFormData,
  parseOrderListQuery,
  toOrderInput,
} from "@/features/orders/schema";
import { allowedTransitions, canTransition, TRANSITIONS } from "@/features/orders/status";
import { sumOrderItems } from "@/lib/money";

import type { OrderStatus } from "@/generated/prisma/enums";

const ALL_STATUSES: OrderStatus[] = ["NEW", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

describe("order status transitions", () => {
  it("allows exactly the transitions of spec section 5.1", () => {
    expect(TRANSITIONS).toEqual({
      NEW: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["SHIPPED", "CANCELLED"],
      SHIPPED: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: [],
    });
  });

  it("covers every status", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...ALL_STATUSES].sort());
  });

  it("permits every allowed move", () => {
    const allowed: [OrderStatus, OrderStatus][] = [
      ["NEW", "CONFIRMED"],
      ["NEW", "CANCELLED"],
      ["CONFIRMED", "SHIPPED"],
      ["CONFIRMED", "CANCELLED"],
      ["SHIPPED", "DELIVERED"],
    ];

    for (const [from, to] of allowed) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it("rejects every forbidden move, including no-ops and rollbacks", () => {
    const forbidden: [OrderStatus, OrderStatus][] = [
      ["NEW", "SHIPPED"],
      ["NEW", "DELIVERED"],
      ["CONFIRMED", "DELIVERED"],
      ["SHIPPED", "CANCELLED"],
      ["SHIPPED", "CONFIRMED"],
      ["DELIVERED", "NEW"],
      ["DELIVERED", "CANCELLED"],
      ["CANCELLED", "CONFIRMED"],
      ["CANCELLED", "NEW"],
      ["NEW", "NEW"],
      ["DELIVERED", "DELIVERED"],
      ["CANCELLED", "CANCELLED"],
    ];

    for (const [from, to] of forbidden) {
      expect(canTransition(from, to)).toBe(false);
    }
  });

  it("treats DELIVERED and CANCELLED as final", () => {
    expect(allowedTransitions("DELIVERED")).toEqual([]);
    expect(allowedTransitions("CANCELLED")).toEqual([]);
  });
});

describe("orderInputSchema", () => {
  const valid = { customerId: "cus_1", items: [{ productId: "prd_1", quantity: 2 }] };

  it("accepts a minimal order", () => {
    expect(orderInputSchema.parse(valid)).toEqual(valid);
  });

  it("turns an empty comment into null", () => {
    expect(orderInputSchema.parse({ ...valid, comment: "  " }).comment).toBeNull();
  });

  it("ignores a total sent by the client", () => {
    const parsed = orderInputSchema.parse({ ...valid, totalKopecks: 1 }) as Record<string, unknown>;
    expect(parsed.totalKopecks).toBeUndefined();
  });

  it("rejects an order without lines", () => {
    expect(orderInputSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
  });

  it("rejects the same product twice", () => {
    const parsed = orderInputSchema.safeParse({
      ...valid,
      items: [
        { productId: "prd_1", quantity: 1 },
        { productId: "prd_1", quantity: 2 },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toMatch(/не повторюються/);
  });

  it("rejects a non-integer or zero quantity", () => {
    expect(
      orderInputSchema.safeParse({ ...valid, items: [{ productId: "p", quantity: 0 }] }).success,
    ).toBe(false);
    expect(
      orderInputSchema.safeParse({ ...valid, items: [{ productId: "p", quantity: 1.5 }] }).success,
    ).toBe(false);
  });

  it("coerces a string quantity coming from a form", () => {
    expect(
      orderInputSchema.parse({ ...valid, items: [{ productId: "p", quantity: "3" }] }).items[0],
    ).toEqual({ productId: "p", quantity: 3 });
  });
});

describe("orderStatusInputSchema", () => {
  it("accepts a known status", () => {
    expect(orderStatusInputSchema.parse({ toStatus: "CONFIRMED" })).toEqual({
      toStatus: "CONFIRMED",
    });
  });

  it("rejects an unknown status", () => {
    expect(orderStatusInputSchema.safeParse({ toStatus: "SHIPPED_IT" }).success).toBe(false);
  });
});

describe("parseOrderListQuery", () => {
  it("keeps status and customer filters", () => {
    expect(parseOrderListQuery({ status: "NEW", customerId: "cus_1", page: "3" })).toEqual({
      status: "NEW",
      customerId: "cus_1",
      page: 3,
      pageSize: 20,
    });
  });

  it("falls back for unusable values", () => {
    expect(parseOrderListQuery({ status: "NOPE", page: "0" })).toEqual({ page: 1, pageSize: 20 });
  });
});

describe("parseOrderFormData", () => {
  it("rebuilds repeating rows in the submitted order", () => {
    const formData = new FormData();
    formData.set("customerId", "cus_1");
    formData.set("comment", "");
    formData.set("items.1.productId", "prd_b");
    formData.set("items.1.quantity", "2");
    formData.set("items.0.productId", "prd_a");
    formData.set("items.0.quantity", "1");

    const parsed = orderFormSchema.parse(parseOrderFormData(formData));

    expect(parsed.items).toEqual([
      { productId: "prd_a", quantity: "1" },
      { productId: "prd_b", quantity: "2" },
    ]);
    expect(toOrderInput(parsed)).toEqual({
      customerId: "cus_1",
      items: [
        { productId: "prd_a", quantity: 1 },
        { productId: "prd_b", quantity: 2 },
      ],
      comment: null,
    });
  });

  it("reports a row with an empty product", () => {
    const formData = new FormData();
    formData.set("customerId", "cus_1");
    formData.set("items.0.productId", "");
    formData.set("items.0.quantity", "1");

    const parsed = orderFormSchema.safeParse(parseOrderFormData(formData));
    expect(parsed.success).toBe(false);
  });
});

describe("order total", () => {
  it("sums quantity times unit price", () => {
    expect(
      sumOrderItems([
        { quantity: 2, unitPriceKopecks: 19900 },
        { quantity: 1, unitPriceKopecks: 4550 },
      ]),
    ).toBe(44350);
  });
});
