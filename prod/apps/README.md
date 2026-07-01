# Production - `apps` mini-server (WSL + Coolify)

Deploys drinkAndDraw v3 to the `apps` homelab server. Containers run in WSL `Ubuntu-24.04`
and are orchestrated/monitored by Coolify. This replaces the Railway deploy (`../railway/`).

- Branch: **`prod/apps`** (push to trigger redeploy).
- Compose: [`docker-compose.yml`](docker-compose.yml) (build context = repo root).
- Image: built from repo-root [`Dockerfile`](../../Dockerfile) (Next.js standalone). Migrations
  run on container start via [`docker-entrypoint.sh`](../../docker-entrypoint.sh)
  (`prisma migrate deploy` then `node server.js`).

## Topology

| Layer | Role |
|-------|------|
| `apps` (Windows 11) | `ssh ADMIN@apps` -> cmd.exe; hosts D: drive + portproxy |
| WSL `Ubuntu-24.04` | Docker engine + Coolify; all containers |
| Tailscale `apps-paas` | `100.93.92.42` for remote access |

## Storage

`STORAGE_DRIVER=local`. Images live on the apps `D:\Data\ModelVivant` drive, exposed to WSL at
`/mnt/d/Data/ModelVivant`, bind-mounted **read-only** into the container at `/data/images`
(`LOCAL_IMAGE_DIR=/data/images`). Files are served by `/api/files/[...path]`.

## Environment (Coolify -> Environment tab)

Set from [`.env.example`](.env.example). Never commit real secrets.

| Variable | Notes |
| -------- | ----- |
| `NEXT_PUBLIC_APP_URL` | Public URL, e.g. `http://apps:3081`. `trustHost: true` covers LAN + Tailscale hosts. Inlined at build; container value overrides at runtime. |
| `AUTH_SECRET` | 16+ chars (`openssl rand -base64 32`). Required in prod. |
| `POSTGRES_PASSWORD` | Password for the bundled `db` service; compose builds `DATABASE_URL` from it. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Optional Google OAuth. |
| `LOG_LEVEL`, `SENTRY_DSN` | Optional observability. |
| `TAG_API_KEY` | Tag management API + MCP (`openssl rand -base64 32`). Required in production. |
| `POSE_LLM_API_KEY` | DeepSeek (or OpenAI-compatible) key for **Describe** pose search. Optional — keyword fallback if unset. Set in Coolify **Environment**, never in Git. |
| `POSE_LLM_BASE_URL` | Default `https://api.deepseek.com/v1` |
| `POSE_LLM_MODEL` | Default `deepseek-chat` |

`DATABASE_URL`, `STORAGE_DRIVER`, `LOCAL_IMAGE_DIR`, `MODEL_VIVANT_DIR` are fixed in compose.
Do **not** set `AUTH_DEV_SECRET` in production.

## Deploy (Coolify)

1. Open Coolify: `http://apps:8000` (LAN) or `http://100.93.92.42:8000` (Tailscale).
2. Project -> **+ New** -> **Docker Compose** (Git based) -> repo `Elliades/drinkAndDraw3`,
   branch `prod/apps`, compose path `prod/apps/docker-compose.yml`.
3. Server: **This machine** (WSL) -- not the Windows LAN IP.
4. Fill **Environment** from `.env.example` -> **Deploy** -> watch **Logs** (the
   `prisma migrate deploy` step must succeed on start).

Emergency / no-Coolify path (run from the repo root so the build context resolves):

```bash
docker compose -f prod/apps/docker-compose.yml --project-directory . up -d --build
```

## LAN exposure (port 3081)

Tailscale reaches the published port directly (`http://100.93.92.42:3081`). For LAN
`http://apps:3081`, add a Windows portproxy + firewall rule on `apps`:

```powershell
# WSLIP = first token of: wsl -d Ubuntu-24.04 -- hostname -I
netsh interface portproxy delete v4tov4 listenport=3081 listenaddress=0.0.0.0
netsh interface portproxy add v4tov4 listenport=3081 listenaddress=0.0.0.0 connectport=3081 connectaddress=WSLIP
netsh advfirewall firewall add rule name=App-3081 dir=in action=allow protocol=TCP localport=3081 profile=any
```

Add `3081` to `C:\paas\keepalive.cmd` (Apps-server `provision/50-autostart.ps1`) so the proxy
survives WSL IP changes.

## Tag normalization (after ingest)

From a dev machine with `DATABASE_URL` pointing at prod (or SSH tunnel):

```bash
# Preview changes
npm run tags:normalize -- --dry-run

# Apply rules (female 1 / male 1, drop part, etc.)
npm run tags:normalize
```

Review remaining bare numeric tags (no `female`/`male` on the reference):

- Admin UI: `http://apps:3081/admin/tags/review`
- API: `GET /api/tags/v1/review/numeric` with header `Authorization: Bearer $TAG_API_KEY`
- MCP: see [`mcp/drinkanddraw-tags/README.md`](../../mcp/drinkanddraw-tags/README.md)

## Post-deploy (one-off)

Populate `Reference` rows from the mounted images (run inside the app container):

```bash
docker exec -it drinkanddraw-app sh -lc "npx tsx scripts/sync-modelvivant.ts --root /data/images"
```

> Note: `tsx`/scripts are not in the slim runtime image. Run the sync from a dev checkout
> pointed at the same `DATABASE_URL`, or temporarily exec it in the builder image. `db:seed`
> is optional.

### Thumbnails

Originals stay on the read-only ModelVivant mount (`/data/images`). WebP grid thumbnails are
written to the writable volume `drinkanddraw-thumb-cache` at `/data/thumb-cache`
(`THUMB_CACHE_DIR` in compose).

After sync, pre-warm the cache from a dev machine with prod `DATABASE_URL` (and
`LOCAL_IMAGE_DIR` / storage pointed at the same files):

```bash
npm run thumbs:backfill
```

Thumbnails are also created lazily on first `/api/thumbs/...` request. Safe to delete the
cache volume contents; they will regenerate.

## Pose indexing (after deploy)

Migrations run automatically on app start (`prisma migrate deploy`). To detect poses and
build search embeddings for the full library, run the pipeline on the apps server (long-running;
~34k images).

**1. Set DeepSeek API key in Coolify** (once):

```bash
# From dev machine (reads key from env); on apps WSL after git pull:
POSE_LLM_API_KEY=sk-... bash prod/apps/set-pose-llm-env.sh
```

**2. Run indexing:**

```bash
bash prod/apps/start-pose-pipeline.sh
# or: bash prod/apps/run-pose-pipeline.sh [--limit N]
```

Logs: `/mnt/c/paas/tmp/pose-pipeline-*.log` — `tail -f` to follow.

## Health & verify

```bash
docker ps --filter name=drinkanddraw
curl -sf http://127.0.0.1:3081/api/health
```

- LAN: `http://apps:3081`
- Tailscale: `http://100.93.92.42:3081`
- Image serving: open a reference; confirm `/api/files/...` returns 200.
