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

RUN pnpm install --frozen-lockfile

# Copy the rest of the source.
COPY . .

# Build shared + db-local + app-a (vite builds the React SPA, tsc the server).
RUN pnpm --filter @sso/shared build \
  && pnpm --filter @sso/db-local build \
  && pnpm --filter @sso/app-a build

EXPOSE 4001

# Apply local-DB migrations, then start the server.
CMD ["sh", "-c", "pnpm --filter @sso/db-local db:migrate:deploy && node applications/app-a/dist/server.js"]
