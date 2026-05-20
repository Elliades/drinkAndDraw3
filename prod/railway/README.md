# Production — Railway

Deploy from the **repository root** (not this folder). Config: [`railway.json`](../../railway.json) (Nixpacks build). On start: [`scripts/ensure-railway-database-url.mjs`](../../scripts/ensure-railway-database-url.mjs) validates or assembles `DATABASE_URL`, then `prisma migrate deploy`, `db:seed`, and `npm start`. **`npm run ingest` is intentionally not in the start command** — it can run for many minutes on S3; the app would not listen until it finished, so Railway’s `/api/health` probe would fail. Run ingest once after deploy (see below). Health check: `GET /api/health`.

## Branch

Railway should track **`prod/railway`**. Push updates trigger deploy.

## Required variables (Build + Deploy)

Set these in the Railway service **Variables** tab. Share with the build phase where Railway allows it.

| Variable | Notes |
| -------- | ----- |
| `DATABASE_URL` | **Must** be the PostgreSQL plugin reference (e.g. `${{Postgres.DATABASE_URL}}`). Do not paste the localhost URL from `.env.example`. Enable for **Build** and **Deploy**. |
| `NODE_ENV` | `production` |
| `AUTH_SECRET` | 16+ characters (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | Public HTTPS URL (not localhost); **required at build time** |
| `STORAGE_DRIVER` | `s3` for production |
| `S3_BUCKET` | Your bucket |
| `AWS_REGION` | e.g. `us-east-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | If not using another AWS credential chain |

Do **not** set `AUTH_DEV_SECRET` in production.

## Verify env on Railway

One-off shell in the service:

```bash
NODE_ENV=production npm run env:verify-prod
```

## Optional

| Variable | Purpose |
| -------- | ------- |
| `S3_PUBLIC_URL` | CDN / public base for image URLs |
| `S3_PREFIX` | Default `references/` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (add redirect URI for prod URL) |
| `SENTRY_DSN`, `LOG_LEVEL` | Observability |

## Post-deploy (one-off)

`railway.json` runs **`db:seed`** on every start (fast, idempotent). After the first successful deploy (or whenever you add images in S3), run **`ingest`** once with the same env as the service (Railway shell, `railway run`, or a one-off job):

```bash
npm run ingest
```

Re-run when you change objects under `S3_PREFIX`. Optional: `npm run tags:from-folders` after ingest.

## Health check

`GET /api/health` — excluded from auth middleware. Configured in `railway.json`.

## Troubleshooting failed deploys

1. **Health check never passes** — If you added `npm run ingest` to the start command, remove it: the HTTP server only starts after ingest finishes, so probes time out. Keep ingest as a post-deploy one-off.
2. **Deploy branch** — In Railway → Service → Settings → Source, set the branch to **`prod/railway`** (not `0-dev`).
3. **`NEXT_PUBLIC_APP_URL`** — Must match the service’s public HTTPS domain (e.g. `https://blissful-insight-production.up.railway.app`) and be shared with the **build** phase.
4. **PostgreSQL** — On the **app** service, set `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (or your plugin’s variable). Remove any hand-typed `localhost:5432` value. If migrate logs show `localhost:5432`, the plugin reference is missing or overridden.
5. **Logs** — [Railway project](https://railway.com/project/49d0b83f-c59d-430a-9ed1-7a8c56511194?environmentId=f6540c17-65fa-4ff2-84b4-e5c659d8f01c); check build logs and the `prisma migrate deploy` step on start.
6. **CI** — [GitHub Actions on `prod/railway`](https://github.com/Elliades/drinkAndDraw3/actions?query=branch%3Aprod%2Frailway) must pass before relying on a Railway deploy.
