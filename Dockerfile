# SaaS starter — production image.
# - better-sqlite3 ships prebuilt binaries for linux/x64; no toolchain needed.
# - Runs migrations at boot (server.ts), so no separate migrate step.
# - Fail-closed: refuses to boot in prod without JWT_SECRET (see config).
# - Mount /data (DB_PATH=/data/app.db) + set APP_URL/CORS_ORIGIN per env.
FROM node:22-bookworm-slim AS base
WORKDIR /srv/app
COPY package.json package-lock.json ./
# Full install (tsx lives in devDependencies and runs the TS server directly).
RUN npm ci && npm cache clean --force

FROM node:22-bookworm-slim AS prod
ENV NODE_ENV=production
WORKDIR /srv/app
COPY --from=base /srv/app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY server.ts index.html ./
COPY public ./public
COPY src ./src
COPY server ./server
RUN mkdir -p /data ./dist && chown -R node:node /srv/app /data
USER node
EXPOSE 40001
ENV PORT=40001 DB_PATH=/data/app.db
CMD ["./node_modules/.bin/tsx", "server.ts"]
