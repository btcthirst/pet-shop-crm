import { describe, expect, it } from "vitest";

import { formatKopecks, parseUahToKopecks, sumOrderItems } from "@/lib/money";

// uk-UA groups thousands with a non-breaking space (U+00A0).
const NBSP = "\u00A0";

describe("formatKopecks", () => {
  it("formats whole hryvnia", () => {
    expect(formatKopecks(1_990_00)).toBe(`1${NBSP}990,00\u00A0₴`);
  });

  it("formats kopecks", () => {
    expect(formatKopecks(1_990_50)).toBe(`1${NBSP}990,50\u00A0₴`);
  });

  it("formats zero", () => {
    expect(formatKopecks(0)).toBe("0,00\u00A0₴");
  });
});

describe("parseUahToKopecks", () => {
  it("converts a decimal price to kopecks", () => {
    expect(parseUahToKopecks("199.5")).toBe(19_950);
  });

  it("accepts a comma decimal separator", () => {
    expect(parseUahToKopecks("12,75")).toBe(1_275);
  });

  it("ignores spaces and non-breaking spaces", () => {
    expect(parseUahToKopecks(" 1 234,56 ")).toBe(123_456);
  });

  it("rounds to the nearest kopeck", () => {
    expect(parseUahToKopecks("10.005")).toBe(1_001);
  });

  it("returns null for empty, negative and non-numeric input", () => {
    expect(parseUahToKopecks("")).toBeNull();
    expect(parseUahToKopecks("   ")).toBeNull();
    expect(parseUahToKopecks("-5")).toBeNull();
    expect(parseUahToKopecks("abc")).toBeNull();
  });
});

describe("sumOrderItems", () => {
  it("returns 0 for an empty list", () => {
    expect(sumOrderItems([])).toBe(0);
  });

  it("sums quantity * unit price", () => {
    expect(
      sumOrderItems([
        { quantity: 2, unitPriceKopecks: 1_990_00 },
        { quantity: 1, unitPriceKopecks: 45_050 },
      ]),
    ).toBe(443_050);
  });
});
