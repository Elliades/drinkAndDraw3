#!/usr/bin/env bash
# Run pose detection + featurization against the live drinkanddraw stack on apps.
# Long-running (~hours for full library). Safe to re-run (resumable).
#
# Usage (on apps WSL):
#   bash prod/apps/run-pose-pipeline.sh
#   bash prod/apps/run-pose-pipeline.sh --limit 50   # smoke test
#
# Requires: docker, git, drinkanddraw app container running (Coolify).

set -euo pipefail

REPO_URL="${POSE_REPO_URL:-https://github.com/Elliades/drinkAndDraw3.git}"
BRANCH="${POSE_REPO_BRANCH:-prod/apps}"
WORK_DIR="${POSE_WORK_DIR:-/mnt/c/paas/drinkanddraw-pose-jobs}"
LOG_DIR="${POSE_LOG_DIR:-/mnt/c/paas/tmp}"

mkdir -p "$LOG_DIR" "$WORK_DIR"
LOG_FILE="$LOG_DIR/pose-pipeline-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== pose pipeline started $(date -Is) ==="
echo "log: $LOG_FILE"
echo "extra args: $*"

APP_CTN="$(docker ps --filter ancestor=drinkanddraw:prod --format '{{.Names}}' | head -1 || true)"
if [[ -z "$APP_CTN" ]]; then
  APP_CTN="$(docker ps --format '{{.Names}}' | grep -E '^app-.*' | head -1 || true)"
fi
if [[ -z "$APP_CTN" ]]; then
  echo "ERROR: drinkanddraw app container not found. Deploy via Coolify first."
  exit 1
fi
echo "app container: $APP_CTN"

NETWORK="$(docker inspect "$APP_CTN" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')"
DATABASE_URL="$(docker inspect "$APP_CTN" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^DATABASE_URL=' | cut -d= -f2-)"
if [[ -z "$NETWORK" || -z "$DATABASE_URL" ]]; then
  echo "ERROR: could not resolve docker network or DATABASE_URL from $APP_CTN"
  exit 1
fi
echo "network: $NETWORK"

if [[ -d "$WORK_DIR/.git" ]]; then
  echo "=== updating repo ==="
  git -C "$WORK_DIR" fetch origin
  git -C "$WORK_DIR" checkout "$BRANCH"
  git -C "$WORK_DIR" pull --ff-only origin "$BRANCH"
else
  echo "=== cloning repo ($BRANCH) ==="
  git clone -b "$BRANCH" "$REPO_URL" "$WORK_DIR"
fi

CLI_ARGS="$*"

echo "=== running pose:detect + pose:featurize in job container ==="
docker run --rm \
  --name drinkanddraw-pose-job \
  --network "$NETWORK" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e STORAGE_DRIVER=local \
  -e LOCAL_IMAGE_DIR=/data/images \
  -e NEXT_PUBLIC_APP_URL=http://app:3000 \
  -v /mnt/d/Data/ModelVivant:/data/images:ro \
  -v drinkanddraw-playwright-cache:/root/.cache/ms-playwright \
  -v "$WORK_DIR:/work" \
  -w /work \
  node:20-bookworm-slim \
  bash -lc "
    set -euo pipefail
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
      git ca-certificates openssl \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
      libpango-1.0-0 libcairo2 > /dev/null
    npm ci --include=dev --quiet
    npx playwright install chromium
    echo '--- pose:detect ---'
    npm run pose:detect -- --base-url http://app:3000 $CLI_ARGS
    echo '--- pose:featurize ---'
    npm run pose:featurize -- $CLI_ARGS
    curl -sf -X POST http://app:3000/api/pose/invalidate-cache || true
    echo '--- done ---'
  "

echo "=== pose pipeline finished $(date -Is) ==="
