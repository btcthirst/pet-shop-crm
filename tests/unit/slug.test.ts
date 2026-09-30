import { describe, expect, it } from "vitest";

import { toSlug } from "@/lib/slug";

describe("toSlug", () => {
  it("transliterates Ukrainian names", () => {
    expect(toSlug("Корм для собак")).toBe("korm-dlia-sobak");
    expect(toSlug("Іграшки")).toBe("ihrashky");
    expect(toSlug("Аксесуари")).toBe("aksesuary");
    expect(toSlug("Їжак")).toBe("yizhak");
  });

  it("keeps latin input and collapses separators", () => {
    expect(toSlug("  Dog   Food  ")).toBe("dog-food");
    expect(toSlug("Корм / для котів")).toBe("korm-dlia-kotiv");
  });

  it("returns an empty slug for symbols only", () => {
    expect(toSlug("!!!")).toBe("");
  });
});
