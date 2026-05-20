#!/usr/bin/env node
/**
 * Railway / Postgres: ensure a single DATABASE_URL for Prisma and npm scripts.
 *
 * - If DATABASE_URL is already set, prints it unchanged (stdout only).
 * - Otherwise builds postgresql:// from PG* / POSTGRES_* fragments (common on Railway).
 *
 * Logs and errors go to stderr so shells can use: export DATABASE_URL="$(node ...)"
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
  const ssl = process.env.PGSSLMODE ? `?sslmode=${encodeURIComponent(process.env.PGSSLMODE)}` : "?sslmode=require";
  return `postgresql://${u}:${p}@${host}:${port}/${d}${ssl}`;
}

const existing = process.env.DATABASE_URL?.trim();
const url = existing || buildFromFragments();

if (!url) {
  logErr(
    "Set DATABASE_URL, or provide PGHOST/PGUSER/PGPASSWORD/PGDATABASE (or POSTGRES_* equivalents).",
  );
  process.exit(1);
}

process.stdout.write(url);
