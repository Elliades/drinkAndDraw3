# Production — Railway

Deploy from the **repository root** (not this folder). Config: [`railway.json`](../../railway.json).

## Branch

Railway should track **`prod/railway`**. Push updates trigger deploy.

## Required variables (Build + Deploy)

Set these in the Railway service **Variables** tab. Share with the build phase where Railway allows it.

| Variable | Notes |
| -------- | ----- |
| `DATABASE_URL` | From the PostgreSQL plugin |
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

```bash
npm run db:seed      # if you want seed data
npm run ingest       # sync Reference rows from S3
```

## Health check

`GET /api/health` — excluded from auth middleware. Configured in `railway.json`.
