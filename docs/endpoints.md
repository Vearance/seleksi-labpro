# Endpoints

Living register of HTTP endpoints. Standard error format for non-OAuth routes:
`{ "error": { "code", "message", "requestId" } }`.

## OAuth Core

| Method | Path | Description | Notes |
| :--- | :--- | :--- | :--- |
| POST | `/oauth/token` | Exchange an authorization code for an access token | OAuth 2.0 error format `{ error, error_description }` |
| GET | `/userinfo` | Return profile for a Bearer access token | Returns `sub`, `name`, `email`, `groups` |
| POST | `/logout` | Revoke the central session and clear the `auth_sid` cookie | Idempotent |

### `POST /oauth/token`

Body (application/x-www-form-urlencoded or JSON):

- `grant_type` — must be `authorization_code`
- `code` — the one-time authorization code
- `client_id`
- `client_secret`
- `code_verifier` — PKCE verifier
- `redirect_uri` — optional; must match the authorize request if provided

Success (200):

```json
{
  "access_token": "<opaque token>",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

Errors use `{ "error": "invalid_grant", "error_description": "..." }` with
`invalid_request` / `invalid_client` / `invalid_grant` / `unsupported_grant_type`.
The code is single-use (atomic consume), short-lived, and bound to its client,
redirect URI, and PKCE challenge.

### `GET /userinfo`

Header: `Authorization: Bearer <access_token>`

Success (200):

```json
{
  "sub": "<user id>",
  "sid": "<central session id>",
  "name": "Alice",
  "email": "alice@example.com",
  "groups": ["employees"]
}
```

Missing/invalid token returns `401` with `WWW-Authenticate: Bearer`.

### `POST /logout`

Revokes the central session identified by the `auth_sid` cookie (marking it
`REVOKED` with reason `sso_logout`), writes an audit `logout` row, and clears
the cookie. Returns `200 { "success": true }` even when there is no active
session (idempotent).

## Health probes (B03)

Liveness = the process responds at all (no dependency checks). Readiness =
dependencies reachable; returns `200` `{ "status": "ok", "checks": {...} }` or
`503` `{ "status": "degraded", "checks": {...} }` naming the failed component
without sensitive internals.

| Service | Liveness | Readiness | Checks |
| :--- | :--- | :--- | :--- |
| auth-server | `GET /health/live` | `GET /health/ready` | `database` (postgres-primary `SELECT 1`) |
| app-a / app-b | `GET /health/live` | `GET /health/ready` | `database` (postgres-local `SELECT 1`) |
| sync-worker | `GET :3002/health/live` | `GET :3002/health/ready` | `database` + `broker` (RabbitMQ queue check) |

`GET /health` remains as a backward-compatible alias of `/health/ready` on
auth-server and the apps.

## Metrics (B02)

| Method | Path | Description | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/metrics` (auth-server) | Prometheus text exposition: HTTP RED metrics, `rabbitmq_queue_messages` (main/retry/DLQ), `outbox_pending_events` | Scrape target |
| GET | `/metrics` (sync-worker :3002) | Prometheus text: `outbox_events_published_total`, `events_handled_total`, `events_dead_lettered_total` | Scrape target |
| GET | `/admin/metrics/snapshot` (auth-server) | JSON snapshot for the control-panel dashboard (latency, errors, queue depths, outbox) | Requires admin session; reached via the control-panel `/admin/*` proxy |

Queue depths are read live from the broker (`checkQueue`); the outbox pending
count comes from the primary DB — both reflect real state, never hardcoded.

## App A (Phase 3)

| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/login` | Generate PKCE + `state`, then redirect to the Auth Provider authorize endpoint |
| GET | `/callback` | Validate state, exchange code, fetch userinfo, create local session + profile cache, redirect home |
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe (postgres-local `SELECT 1`) |
| POST | `/internal/logout` | Revoke local sessions for an event (HMAC-signed, idempotent) |
