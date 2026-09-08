# SaaS starter — production image (API + SPA in one process).
#
# Pipeline: full install -> `npm run build` (Vite SPA into dist/ + esbuild
# server bundle into dist-server/) -> prune dev deps -> ship ONLY:
#   prod node_modules, dist/, dist-server/, migrations/, package.json.
# Source (src/, server/) and dev tooling (tsx, vite, vitest) do NOT ship.
#
# Runtime contract (see server.ts + server/config):
# - migrations run at boot before listen; legacy users.json import included.
# - Fail-closed: refuses to boot in prod without JWT_SECRET.
# - Mount a volume at /data (DB_PATH) or the SQLite DB dies with the container.
# - Set APP_URL + CORS_ORIGIN per environment.
FROM node:22-bookworm-slim AS build
WORKDIR /srv/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build
# Trim dev tooling (tsx, vite, vitest, esbuild...) — prod runs plain `node`.
RUN npm prune --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS prod
ENV NODE_ENV=production PORT=40001 DB_PATH=/data/app.db MIGRATIONS_DIR=/srv/app/migrations
WORKDIR /srv/app
COPY --from=build /srv/app/node_modules ./node_modules
COPY --from=build /srv/app/package.json ./package.json
COPY --from=build /srv/app/dist ./dist
COPY --from=build /srv/app/dist-server ./dist-server
COPY --from=build /srv/app/server/infrastructure/db/migrations ./migrations
RUN mkdir -p /data && chown -R node:node /srv/app /data
USER node
EXPOSE 40001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:40001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist-server/server.mjs"]
