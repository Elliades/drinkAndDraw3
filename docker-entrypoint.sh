#!/bin/sh
set -e

echo "[entrypoint] applying database migrations..."
./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] starting Next.js server..."
exec node server.js
