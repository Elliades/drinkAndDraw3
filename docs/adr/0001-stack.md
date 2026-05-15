# ADR 0001 — Tech stack

**Status**: Accepted (May 2026)
**Replaces**: the `drinkAndDraw2` Express + Mongoose + React SPA setup.

## Decision

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript (strict).
- **Database**: PostgreSQL via Prisma.
- **Auth**: Auth.js v5 (NextAuth) with the Prisma adapter, database sessions.
- **Storage**: `StorageProvider` interface with `LocalStorage` (dev) and `S3Storage` (prod). Selected at boot by `STORAGE_DRIVER`.
- **UI**: Tailwind CSS + small in-house shadcn-style primitives.
- **Server state**: Server Components + Server Actions. No client REST plumbing in app code; TanStack Query reserved for optimistic UI islands if/when needed.
- **Tests**: Vitest (unit) + Playwright (e2e).

## Context

`drinkAndDraw2` accumulated split frontend/backend services, dual storage branching, six speculative Mongoose models with no routes, Firebase stubs returning 501, and a 1944-line `DatabaseTest.tsx` that mixed UI, fetch calls, and simulated sync progress. The user's deployment target is **Railway** (with the **AWS S3** bucket already in place), and they wanted a "simpler" stack with the front not as the bottleneck.

## Rationale

- Next.js collapses two services into one, removes CORS, and lets us replace most client API calls with Server Components + Server Actions.
- Postgres is a first-class Railway add-on; no MongoDB Atlas dependency.
- Prisma migrations replace ad-hoc Mongoose `sync` semantics that caused the original "tag normalization", "folder field", and "path vs folder" bugs.
- A single `StorageProvider` interface deletes the `if (useS3)` branches scattered across the old `imageService.ts` and `routes/images.ts`.

## Consequences

- Bigger Node bundle on Railway than a plain Express + Vite split, but one deploy unit and shared types.
- Server Actions tie tightly to Next; if we ever want a public API, we add `app/api/...` route handlers explicitly.
- Auth.js database sessions mean every request hits Postgres for `Session` lookup. Acceptable at this scale; revisit if we add edge runtime.
