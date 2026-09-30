import { describe, expect, it } from "vitest";

import {
  parseStockMovementListQuery,
  stockMovementFormSchema,
  stockMovementInputSchema,
  toStockMovementInput,
} from "@/features/stock/schema";

const validInput = {
  productId: "product-1",
  delta: 10,
  reason: "RESTOCK" as const,
  note: "Постачальник",
};

describe("stockMovementInputSchema", () => {
  it("accepts a restock with a positive delta", () => {
    expect(stockMovementInputSchema.parse(validInput)).toEqual(validInput);
  });

  it("coerces a string delta coming from a form or a query body", () => {
    const parsed = stockMovementInputSchema.parse({
      ...validInput,
      delta: "-3",
      reason: "CORRECTION",
    });
    expect(parsed.delta).toBe(-3);
  });

  it("allows a correction to take units away", () => {
    expect(
      stockMovementInputSchema.safeParse({ ...validInput, delta: -2, reason: "CORRECTION" })
        .success,
    ).toBe(true);
  });

  it("rejects a restock with a negative delta", () => {
    const parsed = stockMovementInputSchema.safeParse({ ...validInput, delta: -5 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["delta"]);
    }
  });

  it("rejects a zero delta because it would write a meaningless journal entry", () => {
    expect(stockMovementInputSchema.safeParse({ ...validInput, delta: 0 }).success).toBe(false);
  });

  it("rejects a fractional delta", () => {
    expect(stockMovementInputSchema.safeParse({ ...validInput, delta: 1.5 }).success).toBe(false);
  });

  it("rejects a missing product", () => {
    expect(stockMovementInputSchema.safeParse({ ...validInput, productId: "  " }).success).toBe(
      false,
    );
  });

  it("keeps ORDER and CANCEL for the orders feature only", () => {
    expect(stockMovementInputSchema.safeParse({ ...validInput, reason: "ORDER" }).success).toBe(
      false,
    );
    expect(stockMovementInputSchema.safeParse({ ...validInput, reason: "CANCEL" }).success).toBe(
      false,
    );
  });

  it("limits the note length", () => {
    expect(
      stockMovementInputSchema.safeParse({ ...validInput, note: "x".repeat(501) }).success,
    ).toBe(false);
  });
});

describe("stockMovementFormSchema", () => {
  it("keeps the sign typed by the user", () => {
    const parsed = stockMovementFormSchema.parse({
      productId: "product-1",
      delta: "-4",
      reason: "CORRECTION",
      note: "",
    });
    expect(parsed.delta).toBe("-4");
  });

  it("rejects a non-integer or zero delta", () => {
    const base = { productId: "product-1", reason: "RESTOCK", note: "" };
    expect(stockMovementFormSchema.safeParse({ ...base, delta: "2.5" }).success).toBe(false);
    expect(stockMovementFormSchema.safeParse({ ...base, delta: "0" }).success).toBe(false);
    expect(stockMovementFormSchema.safeParse({ ...base, delta: "багато" }).success).toBe(false);
  });

  it("accepts a signed delta and defers the reason rule to the input schema", () => {
    const base = { productId: "product-1", delta: "-2", note: "" };
    expect(stockMovementFormSchema.safeParse({ ...base, reason: "CORRECTION" }).success).toBe(true);
    expect(stockMovementFormSchema.safeParse({ ...base, reason: "RESTOCK" }).success).toBe(true);
  });
});

describe("toStockMovementInput", () => {
  it("turns the form strings into the domain payload", () => {
    expect(
      toStockMovementInput({
        productId: " product-1 ",
        delta: "-4",
        reason: "CORRECTION",
        note: " ",
      }),
    ).toEqual({ productId: "product-1", delta: -4, reason: "CORRECTION", note: "" });
  });

  it("refuses to book a decrease as a restock", () => {
    expect(() =>
      toStockMovementInput({ productId: "product-1", delta: "-4", reason: "RESTOCK", note: "" }),
    ).toThrowError(/додатковим/);
  });
});

describe("parseStockMovementListQuery", () => {
  it("falls back to defaults for an empty query", () => {
    expect(parseStockMovementListQuery({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("keeps the product and reason filters", () => {
    expect(
      parseStockMovementListQuery({ productId: "product-1", reason: "CORRECTION", page: "3" }),
    ).toEqual({ productId: "product-1", reason: "CORRECTION", page: 3, pageSize: 20 });
  });

  it("ignores unusable values instead of failing the page", () => {
    expect(parseStockMovementListQuery({ page: "0", pageSize: "5000", reason: "NOPE" })).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseStockMovementListQuery({ reason: ["ORDER", "CANCEL"] }).reason).toBe("ORDER");
  });
});
