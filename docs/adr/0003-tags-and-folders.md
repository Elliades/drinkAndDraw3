# ADR 0003 — Tags and folders

**Status**: Accepted (May 2026)

## Decision

- **Tags** are a real table (`Tag`), shared between references and drawings via `ReferenceTag` and `DrawingTag` junction tables. `Tag.name` is the canonical normalized form.
- **Tag normalization** lives in `src/domain/tags.ts` (`normalizeTagName`, `normalizeTagList`). Rules: lowercase, trim, collapse internal whitespace and underscores, strip leading/trailing punctuation, max 64 chars.
- **Admin tags vs user tags** share the same `Tag` table; `ReferenceTag.kind` (`USER` | `ADMIN`) disambiguates. Drawings only have user tags (no `kind` column).
- **Folder paths** are a normalized string (`folderPath`) on `Reference`: forward slashes, no leading/trailing slash, empty string for root. Sub-folder queries use `WHERE folderPath = 'X' OR folderPath LIKE 'X/%'`, expressed in Prisma as `OR: [{ folderPath: norm }, { folderPath: { startsWith: norm + '/' } }]`.

## Rationale

The original `imageController.ts` had three bugs that all traced back to inconsistent representation:

1. **Tag normalization missing in folder ops** — `updateFolderTags` skipped the `.trim().toLowerCase()` that `updateImageTags` did, so the same tag could exist twice with different casing.
2. **Folder field set to `localImage.source`** (i.e. `"local"` or `"s3"`) during sync — folder-based filtering became broken on every synced row.
3. **`path` vs `folder` inconsistency** — search used `path`, bulk operations used `folder`, neither consistently.

By making tags a separate table and folders a normalized string with explicit prefix semantics, every operation goes through the same shape. The normalization rule lives in one file (`src/domain/tags.ts`) with thorough unit tests.

## Per-reference tag normalization (June 2026)

After folder-level deduce / `tag.txt` sync, each reference’s USER tag set passes through
[`src/domain/tagReferenceNormalization.ts`](../../src/domain/tagReferenceNormalization.ts):

- Drop noise tag `part`.
- Pure numeric tags (`1`, `2`, …): if `female` and/or `male` is present, replace the digit with
  `female N` / `male N` (both compounds when both genders are present); otherwise keep the bare
  digit and flag the reference for manual review.

Management surfaces:

- REST API `/api/tags/v1/*` (Bearer `TAG_API_KEY` or `X-Tag-Api-Key`).
- MCP server [`mcp/drinkanddraw-tags/`](../../mcp/drinkanddraw-tags/README.md).
- Admin review UI `/admin/tags/review`.
- CLI `npm run tags:normalize`.

## Consequences

- Adding a new tag-bearing entity is a 30-line migration plus a junction table — cheap.
- Folder rename (rare): a single SQL `UPDATE` with `LIKE` is enough; no special migration path needed.
- We did not split admin tags into a separate table; that would add a join for every `Reference.tags` read and didn't justify itself for two enum values.
