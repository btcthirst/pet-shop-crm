import { describe, expect, it } from "vitest";

import {
  customerFormSchema,
  customerInputSchema,
  customerPatchSchema,
  parseCustomerListQuery,
  toCustomerInput,
} from "@/features/customers/schema";
import { normalizePhone } from "@/lib/phone";

const validInput = { name: "Олена Ковальчук", phone: "+380501234567" };

describe("normalizePhone", () => {
  it("keeps an already normalised number", () => {
    expect(normalizePhone("+380501234567")).toBe("+380501234567");
  });

  it("adds the country code to a national number", () => {
    expect(normalizePhone("0501234567")).toBe("+380501234567");
    expect(normalizePhone("501234567")).toBe("+380501234567");
  });

  it("strips spaces, dashes, dots and parentheses", () => {
    expect(normalizePhone("+38 (050) 123-45-67")).toBe("+380501234567");
    expect(normalizePhone("050 123 45 67")).toBe("+380501234567");
    expect(normalizePhone("050.123.45.67")).toBe("+380501234567");
  });

  it("accepts the 00 international prefix", () => {
    expect(normalizePhone("00380501234567")).toBe("+380501234567");
  });

  it("keeps a foreign number that already carries a country code", () => {
    expect(normalizePhone("+1 202 555 0143")).toBe("+12025550143");
  });

  it("rejects anything that cannot become E.164", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("не телефон")).toBeNull();
    expect(normalizePhone("0501234")).toBeNull();
    expect(normalizePhone("+0123456789")).toBeNull();
  });
});

describe("customerInputSchema", () => {
  it("normalises the phone and trims the name", () => {
    const parsed = customerInputSchema.parse({ name: "  Олена  ", phone: "050 123 45 67" });
    expect(parsed).toMatchObject({ name: "Олена", phone: "+380501234567" });
  });

  it("turns empty optional fields into null", () => {
    const parsed = customerInputSchema.parse({ ...validInput, email: "", notes: "" });
    expect(parsed.email).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("keeps a valid email", () => {
    expect(customerInputSchema.parse({ ...validInput, email: "olena@example.com" }).email).toBe(
      "olena@example.com",
    );
  });

  it("rejects an invalid email", () => {
    expect(customerInputSchema.safeParse({ ...validInput, email: "olena@" }).success).toBe(false);
  });

  it("rejects an unusable phone with a hint about E.164", () => {
    const parsed = customerInputSchema.safeParse({ ...validInput, phone: "123" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["phone"]);
      expect(parsed.error.issues[0]?.message).toMatch(/E\.164/);
    }
  });

  it("enforces the documented name length (2–120)", () => {
    expect(customerInputSchema.safeParse({ ...validInput, name: "О" }).success).toBe(false);
    expect(customerInputSchema.safeParse({ ...validInput, name: "x".repeat(121) }).success).toBe(
      false,
    );
  });

  it("allows a partial patch", () => {
    expect(customerPatchSchema.parse({ notes: "домовляємось" })).toEqual({
      notes: "домовляємось",
    });
  });
});

describe("customerFormSchema", () => {
  it("keeps strings so react-hook-form and the server agree", () => {
    const parsed = customerFormSchema.parse({
      name: "Олена",
      phone: "0501234567",
      email: "",
      notes: "",
    });
    expect(parsed.email).toBe("");
    expect(parsed.notes).toBe("");
  });

  it("converts the validated strings into the domain payload", () => {
    const values = customerFormSchema.parse({
      name: "Олена",
      phone: "0501234567",
      email: "",
      notes: "  ",
    });

    expect(toCustomerInput(values)).toEqual({
      name: "Олена",
      phone: "+380501234567",
      email: null,
      notes: null,
    });
  });
});

describe("parseCustomerListQuery", () => {
  it("falls back to defaults", () => {
    expect(parseCustomerListQuery({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("keeps the search term and page", () => {
    expect(parseCustomerListQuery({ q: " Олена ", page: "2" })).toEqual({
      q: "Олена",
      page: 2,
      pageSize: 20,
    });
  });

  it("ignores unusable values", () => {
    expect(parseCustomerListQuery({ page: "-1", pageSize: "999" })).toEqual({
      page: 1,
      pageSize: 20,
    });
  });
});
