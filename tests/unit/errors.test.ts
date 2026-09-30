import { describe, expect, it } from "vitest";

import { AppError, toErrorBody } from "@/lib/errors";

describe("AppError", () => {
  it("maps codes to the documented HTTP statuses", () => {
    expect(new AppError("VALIDATION_ERROR", "bad").status).toBe(400);
    expect(new AppError("UNAUTHORIZED", "no session").status).toBe(401);
    expect(new AppError("FORBIDDEN", "not allowed").status).toBe(403);
    expect(new AppError("NOT_FOUND", "missing").status).toBe(404);
    expect(new AppError("INSUFFICIENT_STOCK", "out of stock").status).toBe(409);
    expect(new AppError("INVALID_TRANSITION", "bad status").status).toBe(409);
  });

  it("serialises to the documented error contract", () => {
    expect(new AppError("NOT_FOUND", "Product not found").toBody()).toEqual({
      error: { code: "NOT_FOUND", message: "Product not found" },
    });
  });

  it("includes details when provided", () => {
    expect(new AppError("VALIDATION_ERROR", "Invalid payload", { field: "sku" }).toBody()).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Invalid payload", details: { field: "sku" } },
    });
  });
});

describe("toErrorBody", () => {
  it("passes AppError through", () => {
    const error = new AppError("INSUFFICIENT_STOCK", "Not enough units", { productId: "p1" });
    expect(toErrorBody(error)).toEqual({ status: 409, body: error.toBody() });
  });

  it("hides unexpected errors behind a 500", () => {
    const { status, body } = toErrorBody(new Error("connection string leaked"));
    expect(status).toBe(500);
    expect(body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
    });
  });
});
