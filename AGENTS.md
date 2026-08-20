# AGENTS.md

## Project Overview

Central Identity & Authorization Provider (SSO platform) for **Seleksi 2 LabPro 2026**.
Authenticates users once (central session), grants access to multiple relying applications
(App A, App B) via OAuth2 Authorization Code + PKCE, and revokes sessions reliably through an
asynchronous event pipeline (transactional outbox → message queue → sync worker →
per-app `/internal/logout`).

**Source of truth for requirements:** `Spesifikasi Tugas Seleksi 2 Laboratorium Pemrograman 2026.md`
(F00–F05 core, B01–B04 bonus). Do NOT re-read it on every change — its requirements are
distilled in "Core Requirements" below and per-task in `tasks/plan.md`. Open the full
spec only when a detail is not covered there.

**Status:** implemented (F00–F05 selesai; bonus B02–B04 selesai, B01 di-skip).
Ordered tasks, acceptance criteria, and checkpoints live in
`tasks/plan.md`; progress is tracked in `tasks/todo.md`. Prefer referring to the plan
for detail instead of duplicating it here.

## Core Requirements (distilled from the spec)

**System scope (F00–F05):**
- Auth Provider Platform: control panel (users, groups, applications, access policies),
  central sessions, OAuth2 Authorization Code + PKCE, access tokens, userinfo, revocation
- Relying apps A & B: local sessions, profile cache, processed events, `/internal/logout`
- Event pipeline: `SessionRevoked` / `PasswordChanged` / `AccessPolicyChanged` via
  transactional outbox → queue → sync worker → apps

**Hard constraints:**
- Monorepo; one `docker compose up` runs all 8 services (Auth Provider, Control Panel,
  App A, App B, Sync Worker, Primary DB, Local DB, broker)
- Relational DB with ORM + automated migrations + idempotent seed
- All secrets via env only (never in code/commits)

**Protocol rules (also see Security Rules below):**
- `redirect_uri` must be exact-match against registered URIs (no prefix, no open redirect)
- Authorization codes: single-use, TTL 2–5 min, stored hashed, consumed atomically
- PKCE `code_challenge`/`code_verifier` verified at token exchange
- Tokens bound to issuing app (subject, audience, expiry, session link) — cross-app use fails
- Policy ALLOW requires: user active AND app active AND redirect URI registered AND user
  has a group assigned to the app AND central session valid; otherwise DENY + `PolicyDenied`
  audit event
- Session valid iff: user active, status active, not expired, not revoked
- Login errors are generic (no user enumeration)

**Relying app rules (F04):**
- Apps never store user credentials; identity comes from the Auth Provider only
- Local sessions independent per app; dedupe incoming events via `processed_events.event_id`
- Forbidden in app DBs: passwords/hashes, client secrets, used authorization codes, raw tokens

**Event pipeline (F05):**
- At-least-once delivery; all handlers idempotent
- Retry with exponential backoff; move to DLQ after max attempts
- Per-app delivery tracked separately — App A failure must never block App B
- Events emitted on: SSO logout, password change, user deactivation, policy change

**Deliverables:** README covering identity (name/NIM), run steps, architecture & flows,
technical decisions (token strategy, broker, service-to-service auth, soft vs hard delete),
stack + versions, endpoint list, bonuses worked on, screenshots.

## Tech Stack

- **Language:** TypeScript (Node.js 22 LTS, strict mode) — all services
- **Monorepo:** pnpm workspaces
- **Backend:** Fastify for every HTTP service; sync-worker is plain Node (no HTTP framework)
- **ORM:** Prisma — one package per database; automated migrations + seed
- **Databases:** PostgreSQL 16 — `postgres-primary` (Auth Provider), `postgres-local` (App A/B)
- **Message broker:** RabbitMQ (dead-letter exchange + TTL retry queue)
- **Frontend:** Vite + React + TypeScript SPAs, built statically and served by Fastify via `@fastify/static` (no Next.js)
- **Password hashing:** argon2id
- **Testing:** Vitest
- **Infra:** Docker Compose — `docker compose up` runs the entire system

## Repository Structure (target)

```
seleksi-labpro/
├── packages/
│   ├── shared/        # @sso/shared — types, zod schemas, error format, crypto, env parsing
│   ├── db/            # @sso/db — Prisma for PRIMARY DB; owns primary migrations + seed
│   └── db-local/      # @sso/db-local — Prisma for LOCAL DB; owns local migrations
├── auth-provider/
│   ├── server/        # @sso/auth-server — Fastify: OAuth, admin API, login
│   ├── control-panel/ # @sso/control-panel — Fastify (thin proxy) + React SPA
│   └── sync-worker/   # @sso/sync-worker — plain Node: outbox publisher + consumer + notifier
├── applications/
│   ├── app-a/         # @sso/app-a — Fastify + React SPA
│   └── app-b/         # @sso/app-b — same shape as app-a
├── infra/             # rabbitmq definitions (queues, DLX) — deferred to Phase 4
├── docs/              # arsitektur, keputusan-teknis, endpoints
├── tasks/             # plan.md, todo.md
├── docker-compose.yml
├── .env.example       # documents every env var (real secrets live in gitignored .env)
└── README.md
```

Docker Compose services (8): `postgres-primary`, `postgres-local`, `rabbitmq`,
`auth-server`, `control-panel`, `sync-worker`, `app-a`, `app-b`.

## Commands

- Install deps: `pnpm install`
- Build all packages: `pnpm -r build`
- Test one package: `pnpm --filter <pkg> test` (Vitest)
- Run the whole system: `docker compose up` (reads `.env`)
- Apply migrations: `pnpm db:migrate`
- Seed (idempotent): `pnpm db:seed`

## Key Technical Decisions (don't re-litigate without discussion)

- **Opaque access tokens** (sha256 hash stored in `access_tokens`, validated via DB
  lookup), not JWT — easier revocation
- **Transactional outbox:** session revocation + `INSERT events` in one Prisma
  `$transaction`; publisher marks `published_at` only after broker confirms
- **RabbitMQ** with DLQ; exponential backoff + jitter; at-least-once delivery
- **Idempotency:** apps dedupe via `processed_events.event_id`
- **Internal auth:** HMAC-SHA256 shared secret + timestamp header on `/internal/logout`
- **Hard delete / deactivate-only** (no `deleted_at` tombstone) — users are deactivated via
  `status`; spec tables have no `deleted_at` and F02 only requires activate/deactivate, so
  this avoids unique + soft-delete conflicts
- **Distinct cookie names** per service: `auth_sid`, `app_a_sid`, `app_b_sid`
- Passwords argon2id; all secrets via env only (never in code or commits)

Detailed rationale and tradeoffs: see `tasks/plan.md` → Architecture Decisions.

## Security Rules (mandatory)

- Standard error format: `{ "error": { "code", "message", "requestId" } }` — never leak
  stack traces, hashes, tokens, or internal policy details
- Redirect URIs must be **exact-match** against registered URIs (no prefix matching,
  no open redirect)
- Authorization codes: single-use, short TTL (2–5 min), stored hashed, consumed atomically
- Access tokens bound to the issuing app — cross-app use must fail
- Login errors are generic (no user enumeration)

## Common Pitfalls

- Browser cookies are **shared across ports on `localhost`** — always validate session
  scope against the owning app's DB
- Browser URLs (`http://localhost:<port>`) differ from internal service URLs
  (`http://<service>:<port>`) — every service needs both `PUBLIC_*` and `INTERNAL_*`
  base-URL env vars
- Two services share each DB — **only the owning Prisma package runs migrations** for it
- Revocation must never be lost when the broker is down (that is what the outbox guarantees)

## Definition of Done

- `pnpm -r build` passes; focused Vitest tests pass; affected services run in compose
- Secrets never committed; `.env.example` documents every required env var
- Follows the standard error format and security rules above
- New/changed endpoints recorded in `docs/endpoints.md`
