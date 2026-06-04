# syntax=docker/dockerfile:1

# drinkAndDraw v3 production image (Next.js standalone + Prisma migrate on start).
# Debian slim is used over alpine for reliable sharp + Prisma engine binaries.

FROM node:20-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---- deps: install all dependencies (incl. dev) for the build ----
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
# postinstall runs `prisma generate`; needs prisma/schema.prisma present.
RUN npm ci

# ---- builder: compile the Next.js standalone bundle ----
FROM deps AS builder
COPY . .
# NEXT_PUBLIC_* are inlined at build time. Accept it as a build arg (Coolify passes it);
# fall back to the LAN URL so the env validator passes. Runtime value still comes from env.
ARG NEXT_PUBLIC_APP_URL=http://apps:3081
ENV NODE_ENV=production
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
RUN npx prisma generate
RUN npm run build

# ---- runner: minimal runtime ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Standalone server output (includes a traced node_modules subset + generated Prisma client).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma schema + migrations and the CLI/engines needed for `migrate deploy` at startup.
# The CLI is invoked as `node node_modules/prisma/build/index.js` (see docker-entrypoint.sh).
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
