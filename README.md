# drinkAndDraw v3

A web application for artists to practice drawing from reference images with timed sessions.

This is a **greenfield rewrite** of the previous `drinkAndDraw2`. See `docs/adr/` (added in Phase 9) for architecture decisions.

## Tech stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript (strict)
- **Database**: PostgreSQL + Prisma
- **Auth**: Auth.js v5 (NextAuth) with Prisma adapter
- **Storage**: pluggable `StorageProvider` — local filesystem in dev, AWS S3 in prod
- **UI**: Tailwind CSS + shadcn-style primitives + lucide-react
- **State**: mostly Server Components + Server Actions; TanStack Query only where needed
- **Tests**: Vitest (unit) + Playwright (e2e)

## Local setup

Prerequisites: Node 20+, Docker.

```bash
cp .env.example .env.local
docker compose up -d db
npm install
# Windows-only: sometimes the sharp platform binary is missed by npm 9.
# If `npm run build` complains about sharp, run:
#   npm install --no-save @img/sharp-win32-x64
npm run db:migrate
npm run db:seed
npm run ingest             # scan ./sample-images and populate references
npm run dev
```

Open `http://localhost:3000`.

## Storage

| Env var          | Value           | Behavior                                                                          |
| ---------------- | --------------- | --------------------------------------------------------------------------------- |
| `STORAGE_DRIVER` | `local`         | Files read from `LOCAL_IMAGE_DIR`, served by `/api/files/[...path]`.              |
| `STORAGE_DRIVER` | `s3`            | Files read from `S3_BUCKET` under `S3_PREFIX`, served via presigned URLs.         |

Switch by changing env and restarting; no runtime toggle.

## Deployment (Railway)

The repo includes `railway.json`: Nixpacks build, start command `npx prisma migrate deploy && npm start`, and health check `GET /api/health` (that route is excluded from auth middleware so probes stay lightweight).

1. Add the **PostgreSQL** plugin and link it so `DATABASE_URL` is available for **both** build and deploy (Prisma client and migrations need it).
2. Set `AUTH_SECRET` (16+ chars) and `NEXT_PUBLIC_APP_URL` to your **public HTTPS** app URL (for example `https://<service>.up.railway.app` or your custom domain). Do not leave the localhost default in production.
3. Set `STORAGE_DRIVER=s3`, `S3_BUCKET`, and `AWS_REGION`. Put AWS access keys in the environment if you use access keys; omit them if the AWS SDK default chain applies (for example an attached IAM role elsewhere). If objects are served through a **replica or CDN** (CloudFront, second bucket, public base URL), set `S3_PUBLIC_URL` to that base URL so image URLs match where browsers load files. `next.config.ts` already allows `*.amazonaws.com` and `*.cloudfront.net` for optimized images; add another `remotePatterns` entry if your CDN hostname differs.
4. Optional: `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` for Google sign-in. After first deploy, run `npm run ingest` (or equivalent one-off) against the same env if you need DB rows synced from storage.

## Scripts

| Command                | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Local dev server                                         |
| `npm run build`        | Production build                                         |
| `npm start`            | Run production build                                     |
| `npm run lint`         | ESLint                                                   |
| `npm run typecheck`    | TypeScript                                               |
| `npm run test`         | Vitest unit tests                                        |
| `npm run test:e2e`     | Playwright end-to-end tests                              |
| `npm run db:migrate`   | Prisma migrate dev                                       |
| `npm run db:seed`      | Seed database                                            |
| `npm run db:studio`    | Open Prisma Studio                                       |
| `npm run ingest`       | Scan storage backend and populate `Reference` rows       |
