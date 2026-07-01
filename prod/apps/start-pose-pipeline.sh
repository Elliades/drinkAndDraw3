#!/usr/bin/env bash
set -euo pipefail
REPO=/mnt/c/paas/drinkanddraw-pose-jobs
if [[ ! -d "$REPO/.git" ]]; then
  git clone -b prod/apps https://github.com/Elliades/drinkAndDraw3.git "$REPO"
else
  git -C "$REPO" fetch origin
  git -C "$REPO" checkout prod/apps
  git -C "$REPO" pull --ff-only origin prod/apps
fi
chmod +x "$REPO/prod/apps/run-pose-pipeline.sh"
nohup bash "$REPO/prod/apps/run-pose-pipeline.sh" > /mnt/c/paas/tmp/pose-pipeline-launcher.log 2>&1 &
echo $! > /mnt/c/paas/tmp/pose-pipeline.pid
echo "started pid=$(cat /mnt/c/paas/tmp/pose-pipeline.pid)"
sleep 2
ls -t /mnt/c/paas/tmp/pose-pipeline-*.log 2>/dev/null | head -1 || true
tail -5 /mnt/c/paas/tmp/pose-pipeline-launcher.log 2>/dev/null || true
