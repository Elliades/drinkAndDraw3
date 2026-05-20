#!/usr/bin/env node
/**
 * Railway / Postgres: validate DATABASE_URL and print it for Prisma/npm (stdout only).
 *
 * - If DATABASE_URL is set: must be a valid URL and not localhost (catches .env.example leaks).
 * - Else builds postgresql:// from PG* / POSTGRES_* fragments (some Railway layouts).
 *
 * Logs and errors → stderr. Final URL → stdout only (for: export DATABASE_URL="$(node ...)").
 */

function logErr(...args) {
  console.error("[ensure-railway-database-url]", ...args);
}

function buildFromFragments() {
  const user = process.env.PGUSER ?? process.env.POSTGRES_USER;
  const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD;
  const host = process.env.PGHOST ?? process.env.POSTGRES_HOST;
  const port = (process.env.PGPORT ?? process.env.POSTGRES_PORT ?? "5432").trim();
  const database =
    process.env.PGDATABASE ?? process.env.POSTGRES_DATABASE ?? process.env.POSTGRES_DB;

  if (!user || !password || !host || !database) {
    return null;
  }

  const u = encodeURIComponent(user);
  const p = encodeURIComponent(password);
  const d = encodeURIComponent(database);
  const ssl = process.env.PGSSLMODE
    ? `?sslmode=${encodeURIComponent(process.env.PGSSLMODE)}`
    : "?sslmode=require";
  return `postgresql://${u}:${p}@${host}:${port}/${d}${ssl}`;
}

function assertNotLocalDev(urlString) {
  try {
    const { hostname } = new URL(urlString);
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      logErr(
        [
          `DATABASE_URL points at ${hostname} (local dev).`,
          "In Railway: set DATABASE_URL on this service to the PostgreSQL plugin reference",
          "(e.g. ${{Postgres.DATABASE_URL}}), shared with Build and Deploy — not .env.example.",
        ].join("\n"),
      );
      process.exit(1);
    }
  } catch {
    logErr("DATABASE_URL is not a valid URL.");
    process.exit(1);
  }
}

const existing = process.env.DATABASE_URL?.trim();
const url = existing || buildFromFragments();

if (!url) {
  logErr(
    [
      "DATABASE_URL is not set and PG* / POSTGRES_* fragments are incomplete.",
      "In Railway: add the PostgreSQL plugin and set DATABASE_URL on this service",
      "to the plugin reference (e.g. ${{Postgres.DATABASE_URL}}), shared with Build and Deploy.",
      "Alternatively set PGHOST, PGUSER, PGPASSWORD, and PGDATABASE.",
    ].join("\n"),
  );
  process.exit(1);
}

assertNotLocalDev(url);
process.stdout.write(url);
