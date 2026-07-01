#!/usr/bin/env bash
set -euo pipefail
TARGET=e91b867
for i in $(seq 1 24); do
  sleep 15
  CTN=$(docker ps -q --filter ancestor=drinkanddraw:prod | head -1 || true)
  if [[ -z "$CTN" ]]; then
    echo "[$i] no container yet"
    continue
  fi
  COMMIT=$(docker inspect "$CTN" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^SOURCE_COMMIT=' | cut -d= -f2- || true)
  STATUS=$(docker ps --filter id="$CTN" --format '{{.Status}}')
  echo "[$i] $STATUS commit=${COMMIT:-none}"
  curl -sf http://127.0.0.1:3081/api/health >/dev/null && echo "health=ok" || echo "health=wait"
  if [[ "${COMMIT:-}" == *"$TARGET"* ]]; then
    echo "deploy ready"
    exit 0
  fi
done
echo "timeout waiting for deploy"
exit 1
