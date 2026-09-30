/** Collapses Next.js `searchParams` (values may repeat) into a plain record. */
export function flattenSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(searchParams).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, Array.isArray(value) ? (value[0] ?? "") : value]],
    ),
  );
}
