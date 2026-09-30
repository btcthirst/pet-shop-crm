import { describe, expect, it } from "vitest";

import {
  parseProductListQuery,
  productFormSchema,
  productInputSchema,
  productPatchSchema,
  toProductInput,
} from "@/features/products/schema";
import { categoryInputSchema } from "@/features/categories/schema";
import { AppError } from "@/lib/errors";

const validInput = {
  sku: "DOG-001",
  name: "Корм для собак",
  description: "Гранули 2 кг",
  priceKopecks: 24990,
  categoryId: "cat-1",
  lowStockThreshold: 5,
};

describe("productInputSchema", () => {
  it("accepts a valid payload and trims text", () => {
    const parsed = productInputSchema.parse({ ...validInput, sku: "  DOG-001  " });
    expect(parsed.sku).toBe("DOG-001");
  });

  it("turns an empty description into null", () => {
    expect(productInputSchema.parse({ ...validInput, description: "" }).description).toBeNull();
  });

  it("defaults the low-stock threshold to 5", () => {
    const withoutThreshold: Omit<typeof validInput, "lowStockThreshold"> = {
      sku: validInput.sku,
      name: validInput.name,
      description: validInput.description,
      priceKopecks: validInput.priceKopecks,
      categoryId: validInput.categoryId,
    };
    expect(productInputSchema.parse(withoutThreshold).lowStockThreshold).toBe(5);
  });

  it("enforces the documented sku length (2–32)", () => {
    expect(productInputSchema.safeParse({ ...validInput, sku: "D" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...validInput, sku: "X".repeat(33) }).success).toBe(
      false,
    );
    expect(productInputSchema.safeParse({ ...validInput, sku: "XY" }).success).toBe(true);
  });

  it("enforces the documented name length (2–120)", () => {
    expect(productInputSchema.safeParse({ ...validInput, name: "Я" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...validInput, name: "Я".repeat(121) }).success).toBe(
      false,
    );
  });

  it("rejects a non-integer or negative price", () => {
    expect(productInputSchema.safeParse({ ...validInput, priceKopecks: -1 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...validInput, priceKopecks: 10.5 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...validInput, priceKopecks: "100" }).success).toBe(true);
  });

  it("requires a category", () => {
    expect(productInputSchema.safeParse({ ...validInput, categoryId: "" }).success).toBe(false);
  });
});

describe("productPatchSchema", () => {
  it("keeps every field optional and accepts the activation flag", () => {
    expect(productPatchSchema.parse({})).toEqual({});
    expect(productPatchSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });

  it("still validates the fields that are present", () => {
    expect(productPatchSchema.safeParse({ priceKopecks: -5 }).success).toBe(false);
  });
});

describe("productFormSchema and toProductInput", () => {
  const validForm = {
    sku: "DOG-002",
    name: "Іграшка",
    description: "",
    price: "249,90",
    categoryId: "cat-1",
    lowStockThreshold: "5",
  };

  it("keeps the form payload as strings", () => {
    expect(productFormSchema.parse(validForm)).toEqual(validForm);
  });

  it("converts hryvnia to kopecks without floating point drift", () => {
    expect(toProductInput(validForm).priceKopecks).toBe(24990);
    expect(toProductInput({ ...validForm, price: "1 234.56" }).priceKopecks).toBe(123456);
    expect(toProductInput({ ...validForm, price: "0" }).priceKopecks).toBe(0);
  });

  it("maps an empty description to null", () => {
    expect(toProductInput(validForm).description).toBeNull();
    expect(toProductInput({ ...validForm, description: "Текст" }).description).toBe("Текст");
  });

  it("rejects a price that is not a number", () => {
    expect(productFormSchema.safeParse({ ...validForm, price: "двісті" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...validForm, price: "-5" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...validForm, price: "" }).success).toBe(false);
  });

  it("rejects a fractional or negative low-stock threshold", () => {
    expect(productFormSchema.safeParse({ ...validForm, lowStockThreshold: "2.5" }).success).toBe(
      false,
    );
    expect(productFormSchema.safeParse({ ...validForm, lowStockThreshold: "-1" }).success).toBe(
      false,
    );
  });

  it("throws a validation AppError when a price cannot be parsed", () => {
    expect(() => toProductInput({ ...validForm, price: "двісті" })).toThrowError(AppError);
  });
});

describe("categoryInputSchema", () => {
  it("requires 2–60 characters", () => {
    expect(categoryInputSchema.safeParse({ name: "Я" }).success).toBe(false);
    expect(categoryInputSchema.safeParse({ name: "Я".repeat(61) }).success).toBe(false);
    expect(categoryInputSchema.safeParse({ name: "Іграшки" }).success).toBe(true);
  });

  it("trims the name", () => {
    expect(categoryInputSchema.parse({ name: "  Аксесуари  " }).name).toBe("Аксесуари");
  });
});

describe("parseProductListQuery", () => {
  it("applies defaults for an empty query", () => {
    expect(parseProductListQuery({})).toEqual({
      q: undefined,
      categoryId: undefined,
      page: 1,
      pageSize: 20,
      lowStock: false,
    });
  });

  it("parses the documented filters", () => {
    expect(
      parseProductListQuery({
        q: "корм",
        categoryId: "cat-1",
        page: "3",
        pageSize: "10",
        lowStock: "true",
      }),
    ).toEqual({ q: "корм", categoryId: "cat-1", page: 3, pageSize: 10, lowStock: true });
  });

  it("treats an absent or falsy lowStock flag as false", () => {
    expect(parseProductListQuery({ lowStock: "false" }).lowStock).toBe(false);
    expect(parseProductListQuery({ lowStock: "" }).lowStock).toBe(false);
    expect(parseProductListQuery({ lowStock: "0" }).lowStock).toBe(false);
    expect(parseProductListQuery({ lowStock: "1" }).lowStock).toBe(true);
  });

  it("falls back to defaults for unusable values", () => {
    const parsed = parseProductListQuery({ page: "-2", pageSize: "999" });
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseProductListQuery({ q: ["корм", "іграшки"] }).q).toBe("корм");
  });
});
