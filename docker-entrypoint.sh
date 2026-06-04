#!/bin/sh
set -e

echo "[entrypoint] applying database migrations..."
# Invoke the Prisma CLI from its package dir so it resolves its sibling .wasm/engine
# files correctly (the node_modules/.bin shim does not survive a partial copy).
node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] starting Next.js server..."
exec node server.js
