# Production — Railway

Deploy this app from the repository root. The active Railway config is [`railway.json`](../../railway.json) at the project root (Nixpacks build, `DATABASE_URL` resolution via [`scripts/ensure-railway-database-url.mjs`](../../scripts/ensure-railway-database-url.mjs), migrate + seed + ingest + start, `/api/health` health check).

Configure secrets and env vars in the Railway service dashboard; see [`.env.example`](../../.env.example) for the variable names your app expects.
