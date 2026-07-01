#!/usr/bin/env bash
set -euo pipefail
TARGET="${1:-5f26487}"
for i in $(seq 1 24); do
  sleep 10
  CTN=$(docker ps -q --filter ancestor=drinkanddraw:prod | head -1 || true)
  [[ -z "$CTN" ]] && echo "[$i] no container" && continue
  COMMIT=$(docker inspect "$CTN" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^SOURCE_COMMIT=' | cut -d= -f2- || true)
  KEY_SET=$(docker inspect "$CTN" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^POSE_LLM_API_KEY=' | cut -d= -f2- | wc -c)
  echo "[$i] commit=${COMMIT:0:7} key_len=$KEY_SET"
  curl -sf http://127.0.0.1:3081/api/health >/dev/null && echo health=ok || echo health=wait
  [[ "${COMMIT:-}" == *"$TARGET"* ]] && [[ "$KEY_SET" -gt 5 ]] && echo ready && exit 0
done
exit 1
