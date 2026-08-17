FROM node:22-alpine

RUN corepack enable

WORKDIR /app

ENV CI=true

# Copy workspace manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/db-local/package.json ./packages/db-local/
COPY auth-provider/server/package.json ./auth-provider/server/
COPY auth-provider/control-panel/package.json ./auth-provider/control-panel/
COPY applications/app-a/package.json ./applications/app-a/
COPY applications/app-b/package.json ./applications/app-b/
COPY auth-provider/sync-worker/package.json ./auth-provider/sync-worker/

RUN pnpm install --frozen-lockfile

# Copy the rest of the source.
COPY . .

# Build the packages the server needs (db/db-local for startup migrations).
RUN pnpm --filter @sso/shared build \
  && pnpm --filter @sso/db build \
  && pnpm --filter @sso/db-local build \
  && pnpm --filter @sso/auth-server build

EXPOSE 3000

# Apply primary-DB migrations + seed, then start the server.
CMD ["sh", "-c", "pnpm --filter @sso/db db:migrate:deploy && pnpm --filter @sso/db db:seed && node auth-provider/server/dist/server.js"]
