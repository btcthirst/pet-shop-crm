import { describe, expect, it } from "vitest";

import { plural } from "@/lib/plural";

const forms = { one: "товар", few: "товари", many: "товарів" };

describe("plural", () => {
  it("uses the singular form for 1", () => {
    expect(plural(1, forms)).toBe("товар");
  });

  it("uses the paucal form for 2–4", () => {
    expect(plural(2, forms)).toBe("товари");
    expect(plural(3, forms)).toBe("товари");
    expect(plural(4, forms)).toBe("товари");
  });

  it("uses the genitive plural for 0, 5+ and teens", () => {
    expect(plural(0, forms)).toBe("товарів");
    expect(plural(5, forms)).toBe("товарів");
    expect(plural(11, forms)).toBe("товарів");
    expect(plural(21, forms)).toBe("товар");
    expect(plural(22, forms)).toBe("товари");
    expect(plural(100, forms)).toBe("товарів");
  });
});
