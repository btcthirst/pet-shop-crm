const uahFormatter = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 2,
});

/** Formats an amount stored in kopecks as UAH. Display only: never used for calculations. */
export function formatKopecks(kopecks: number): string {
  return uahFormatter.format(kopecks / 100);
}

/** Parses a user-entered price in hryvnia into kopecks without floating point drift. */
export function parseUahToKopecks(input: string): number | null {
  const normalized = input.trim().replace(/\s| /g, "").replace(",", ".");
  if (normalized === "") return null;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * 100);
}

/** Sums order lines: sum(quantity * unitPriceKopecks). The only place totals are calculated. */
export function sumOrderItems(
  items: readonly { quantity: number; unitPriceKopecks: number }[],
): number {
  return items.reduce((total, item) => total + item.quantity * item.unitPriceKopecks, 0);
}
