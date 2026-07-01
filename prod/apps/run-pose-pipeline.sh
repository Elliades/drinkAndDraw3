#!/usr/bin/env bash
# Run pose detection + featurization against the live drinkanddraw stack on apps.
# Long-running (~hours for full library). Safe to re-run (resumable).
#
# Runs on the WSL host (not inside an isolated container) so Playwright can reach
# http://127.0.0.1:3081 and read images from /mnt/d/Data/ModelVivant.
#
# Usage:
#   bash prod/apps/run-pose-pipeline.sh
#   bash prod/apps/run-pose-pipeline.sh --limit 50

set -euo pipefail

REPO_URL="${POSE_REPO_URL:-https://github.com/Elliades/drinkAndDraw3.git}"
BRANCH="${POSE_REPO_BRANCH:-prod/apps}"
WORK_DIR="${POSE_WORK_DIR:-/mnt/c/paas/drinkanddraw-pose-jobs}"
LOG_DIR="${POSE_LOG_DIR:-/mnt/c/paas/tmp}"
IMAGE_ROOT="${POSE_IMAGE_ROOT:-/mnt/d/Data/ModelVivant}"
BASE_URL="${POSE_BASE_URL:-http://127.0.0.1:3081}"

mkdir -p "$LOG_DIR" "$WORK_DIR"
LOG_FILE="$LOG_DIR/pose-pipeline-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== pose pipeline started $(date -Is) ==="
echo "log: $LOG_FILE"
echo "extra args: $*"

APP_CTN="$(docker ps --filter ancestor=drinkanddraw:prod --format '{{.Names}}' | head -1 || true)"
if [[ -z "$APP_CTN" ]]; then
  echo "ERROR: drinkanddraw app container not found."
  exit 1
fi
echo "app container: $APP_CTN"

DATABASE_URL="$(docker inspect "$APP_CTN" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^DATABASE_URL=' | cut -d= -f2-)"
if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: could not read DATABASE_URL from app container"
  exit 1
fi

if [[ ! -d "$IMAGE_ROOT" ]]; then
  echo "ERROR: image root not found at $IMAGE_ROOT"
  exit 1
fi

if [[ -d "$WORK_DIR/.git" ]]; then
  echo "=== updating repo ==="
  git -C "$WORK_DIR" fetch origin
  git -C "$WORK_DIR" checkout "$BRANCH"
  git -C "$WORK_DIR" pull --ff-only origin "$BRANCH"
else
  echo "=== cloning repo ($BRANCH) ==="
  git clone -b "$BRANCH" "$REPO_URL" "$WORK_DIR"
fi

cd "$WORK_DIR"

export DATABASE_URL
export STORAGE_DRIVER=local
export LOCAL_IMAGE_DIR="$IMAGE_ROOT"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://apps:3081}"

if ! command -v node >/dev/null 2>&1; then
  echo "=== installing Node 20 on WSL host ==="
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
echo "node $(node -v) npm $(npm -v)"

echo "=== npm ci + playwright (host) ==="
npm ci --include=dev --quiet
npx playwright install chromium

echo "--- pose:detect ---"
npm run pose:detect -- --base-url "$BASE_URL" "$@"

echo "--- pose:featurize ---"
npm run pose:featurize -- "$@"

curl -sf -X POST "$BASE_URL/api/pose/invalidate-cache" || true

echo "=== pose pipeline finished $(date -Is) ==="
