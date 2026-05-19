/**
 * Fail fast when DATABASE_URL is missing or still points at local dev Postgres.
 * Run before `prisma migrate deploy` on Railway (see railway.json).
 */
const url = process.env.DATABASE_URL?.trim();

if (!url) {
  console.error(
    [
      "DATABASE_URL is not set.",
      "In Railway: add the PostgreSQL plugin and set DATABASE_URL on this service",
      "to the plugin reference (e.g. ${{Postgres.DATABASE_URL}}), shared with Build and Deploy.",
    ].join("\n"),
  );
  process.exit(1);
}

try {
  const { hostname } = new URL(url);
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    console.error(
      [
        `DATABASE_URL points at ${hostname} (local dev).`,
        "Replace it with the Railway PostgreSQL connection string from the plugin,",
        "not the value from .env.example.",
      ].join("\n"),
    );
    process.exit(1);
  }
} catch {
  console.error("DATABASE_URL is not a valid URL.");
  process.exit(1);
}

console.log("DATABASE_URL OK (not localhost).");
