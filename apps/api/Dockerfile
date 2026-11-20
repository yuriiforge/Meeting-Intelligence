# Build context: repository root (needed for the npm workspace lockfile).

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
# The schema must be present before install: postinstall runs `prisma generate`.
COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
RUN npm ci -w @mi/api
COPY apps/api apps/api
RUN npm run build -w @mi/api

# One-off job: applies pending migrations, then exits. Runs before the api.
FROM build AS migrate
WORKDIR /app/apps/api
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
# No Prisma CLI in production deps, so skip the postinstall generate; the
# generated client is already compiled into dist.
RUN npm ci -w @mi/api --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
