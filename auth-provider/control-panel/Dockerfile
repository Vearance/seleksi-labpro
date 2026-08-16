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

RUN pnpm install --frozen-lockfile

# Copy the rest of the source.
COPY . .

# Build shared + control-panel (vite builds the React SPA, tsc builds the server).
RUN pnpm --filter @sso/shared build \
  && pnpm --filter @sso/control-panel build

EXPOSE 3001

CMD ["node", "auth-provider/control-panel/dist/server.js"]
