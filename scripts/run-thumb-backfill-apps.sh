#!/usr/bin/env bash
set -euo pipefail
NET=ob87a74x8ubsbztx6wtdeiep
WORKDIR=/tmp/drinkanddraw-backfill
VOL=ob87a74x8ubsbztx6wtdeiep_drinkanddraw-thumb-cache
ENV_FILE=/data/coolify/applications/ob87a74x8ubsbztx6wtdeiep/.env
LOG=/tmp/thumb-backfill.log

set -a
source "$ENV_FILE"
set +a

export DATABASE_URL="postgresql://drinkanddraw:${POSTGRES_PASSWORD}@db:5432/drinkanddraw"
export STORAGE_DRIVER=local
export LOCAL_IMAGE_DIR=/data/images
export THUMB_CACHE_DIR=/data/thumb-cache

if [[ ! -d /mnt/d/Data/ModelVivant ]]; then
  echo "ModelVivant mount missing" >&2
  exit 1
fi

if [[ ! -d "$WORKDIR/.git" ]]; then
  git clone --depth 1 -b prod/apps https://github.com/Elliades/drinkAndDraw3.git "$WORKDIR"
else
  cd "$WORKDIR"
  git fetch --depth 1 origin prod/apps
  git checkout prod/apps
  git reset --hard origin/prod/apps
fi

echo "=== thumb backfill start $(date -Is) ===" | tee "$LOG"

docker run --rm \
  --network "$NET" \
  -v /mnt/d/Data/ModelVivant:/data/images:ro \
  -v "${VOL}:/data/thumb-cache" \
  -v "${WORKDIR}:${WORKDIR}" \
  -w "$WORKDIR" \
  -e DATABASE_URL \
  -e STORAGE_DRIVER \
  -e LOCAL_IMAGE_DIR \
  -e THUMB_CACHE_DIR \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_APP_URL=http://apps:3081 \
  -e AUTH_SECRET \
  node:20-bookworm-slim \
  bash -lc "export NPM_CONFIG_PRODUCTION=false; apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq openssl ca-certificates > /dev/null && npm ci --quiet && npx tsx scripts/backfill-thumbnails.ts" \
  2>&1 | tee -a "$LOG"

echo "=== thumb backfill done $(date -Is) ===" | tee -a "$LOG"
