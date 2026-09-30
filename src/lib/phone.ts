/**
 * Phone normalisation (spec section 5.5): the CRM stores phones in E.164, so the same
 * customer cannot be saved twice as `050 123 45 67` and `+380501234567`.
 *
 * Ukrainian numbers are entered in many shapes, so the national part is recognised and
 * prefixed with the country code; anything that already carries a country code is kept.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const dialled = trimmed.replace(/\D/g, "");

  if (!dialled) return null;

  // `00` is how `+` gets dialled from many countries; an explicit `+` is already international.
  const hasCountryCode = trimmed.startsWith("+") || dialled.startsWith("00");
  const international = dialled.startsWith("00") ? dialled.slice(2) : dialled;

  if (hasCountryCode) {
    // An explicit country code must be plausible: E.164 caps at 15 digits, no leading zero.
    return /^[1-9]\d{9,14}$/.test(international) ? `+${international}` : null;
  }

  // Ukrainian national forms: `0501234567` (trunk zero) or `501234567`.
  if (dialled.length === 10 && dialled.startsWith("0")) {
    return `+380${dialled.slice(1)}`;
  }

  if (dialled.length === 9) {
    return `+380${dialled}`;
  }

  // Without a country-code marker only plainly international numbers are accepted.
  return /^[1-9]\d{9,14}$/.test(dialled) ? `+${dialled}` : null;
}
