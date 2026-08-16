# Endpoints

Living register of HTTP endpoints. Standard error format for non-OAuth routes:
`{ "error": { "code", "message", "requestId" } }`.

## OAuth Core

| Method | Path | Description | Notes |
| :--- | :--- | :--- | :--- |
| POST | `/oauth/token` | Exchange an authorization code for an access token | OAuth 2.0 error format `{ error, error_description }` |
| GET | `/userinfo` | Return profile for a Bearer access token | Returns `sub`, `name`, `email`, `groups` |

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
  "name": "Alice",
  "email": "alice@example.com",
  "groups": ["employees"]
}
```

Missing/invalid token returns `401` with `WWW-Authenticate: Bearer`.
