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

1. Create a Postgres add-on. Railway sets `DATABASE_URL`.
2. Set `STORAGE_DRIVER=s3` plus AWS creds and `S3_BUCKET`.
3. Set `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, optional `AUTH_GOOGLE_*`.
4. Build command: `npm run build`. Start command: `npm start`. Migrations run automatically via `prisma migrate deploy` in CI/CD.

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
