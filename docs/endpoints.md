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

## App A (Phase 3)

| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/login` | Generate PKCE + `state`, then redirect to the Auth Provider authorize endpoint |
| GET | `/callback` | Validate state, exchange code, fetch userinfo, create local session + profile cache, redirect home |
| GET | `/health` | Liveness probe |
