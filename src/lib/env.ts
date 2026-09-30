function pickEnv(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => typeof value === "string" && value.length > 0);
}

/**
 * The Neon dev branch (`DATABASE_URL_DEV`) wins when it is set, so local work never
 * touches demo data. On Vercel and in CI the `*_DEV` variables are absent and the
 * main database is used instead.
 */
export function getDatabaseUrl(): string {
  const url = pickEnv(process.env.DATABASE_URL_DEV, process.env.DATABASE_URL);

  if (!url) {
    throw new Error(
      "Neither DATABASE_URL_DEV nor DATABASE_URL is set. Copy .env.example to .env and fill in the Neon connection strings.",
    );
  }

  return url;
}
