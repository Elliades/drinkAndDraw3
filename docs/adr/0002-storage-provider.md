# ADR 0002 — Storage abstraction

**Status**: Accepted (May 2026)

## Decision

A single `StorageProvider` interface (`src/storage/types.ts`) with two implementations: `LocalStorageProvider` and `S3StorageProvider`. The active provider is chosen once at startup from `STORAGE_DRIVER` (`local` | `s3`) and cached.

Public surface: `list`, `exists`, `head`, `read`, `put`, `delete`, `getUrl`. Callers never branch by driver.

## Rationale

The previous code at `backend/src/services/imageService.ts` and `backend/src/routes/images.ts` repeatedly tested `useS3` to choose between filesystem scans and S3 SDK calls. Local and S3 URLs also followed different conventions (a `/api/v1/images/serve/...` path vs. S3 signed URL). This caused inconsistencies (e.g., signed URL TTLs hidden inside listings, broken thumbnail key construction on delete).

Keeping driver selection in one place and forbidding driver checks in feature code eliminates that class of bug.

## Local driver

- Files live under `LOCAL_IMAGE_DIR` (default `./sample-images`).
- `getUrl(key)` returns `/api/files/<encoded-key>`, served by `app/api/files/[...path]/route.ts`.
- Path traversal is blocked by `path.resolve` + prefix check.

## S3 driver

- Lists with full pagination via `ContinuationToken` (the old code defaulted to `MaxKeys: 100`).
- `getUrl(key)` returns a presigned URL (default TTL 1h) unless `S3_PUBLIC_URL` is set, in which case it returns a public URL.
- Uploads keyed under `S3_PREFIX` (default `references/`); drawing uploads use the same provider under `drawings/<userId>/`.

## Switching at runtime

Not supported. Change env, restart. This matches the env-driven `storageConfig` from the previous repo, minus the misleading `/storage/switch` endpoint that pretended to switch but only printed instructions.
