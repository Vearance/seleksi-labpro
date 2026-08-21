# Endpoints


## Auth Provider Core (auth-server, :3000)

| Method | Path | Deskripsi | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/` | Identitas user yang login + tombol logout SSO global | Redirect ke `/login` bila belum ada central session |
| GET | `/login` | Halaman login | `?return_to=/oauth/authorize..` untuk lanjut authorize setelah login |
| POST | `/login` | `{email, password}` -> buat central session + set-cookie `auth_sid` | Gagal -> Error 401 |
| POST | `/logout` | Revoke central session (cookie `auth_sid`) + emit `SessionRevoked` via outbox + clear cookie | Idempotent; access token milik session ikut di-revoke |
| GET | `/oauth/authorize` | OAuth authorize: validasi client, exact-match `redirect_uri`, PKCE, evaluasi policy, buat one-time code | Tanpa session -> redirect `/login?return_to=..`; request tidak valid -> error page; policy deny -> redirect `?error=access_denied` |
| POST | `/oauth/token` | Menukar authorization code menjadi opaque access token | Single-use only, error invalid_grant otherwise |
| GET | `/userinfo` | Header request `Authorization: Bearer <token>` | 401 + `WWW-Authenticate: Bearer` apabila token invalid/revoked/expired |

### `POST /oauth/token`

Body (form-urlencoded atau JSON): `grant_type=authorization_code`, `code`,
`client_id`, `client_secret`, `code_verifier`, `redirect_uri` (opsional, harus
sama dengan permintaan authorize).

Sukses (200):

```json
{
  "access_token": "<opaque token>",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

Error memakai `invalid_request` / `invalid_client` / `invalid_grant` /
`unsupported_grant_type`.

## Admin API (di belakang control panel, :3000, diakses via `/admin/*` proxy :3001)

Route butuh session admin (cookie `cp_sid`).

| Method | Path | Deskripsi |
| :--- | :--- | :--- |
| POST | `/admin/login` | Admin login (anggota group `admin`) -> set-cookie `cp_sid` (signed) |
| GET | `/admin/me` | Identitas admin yang sedang login |
| POST | `/admin/logout` | Hapus sesi admin |
| GET | `/admin/users` | Daftar user |
| POST | `/admin/users` | Buat user `{name, email, password, status?}` |
| PATCH | `/admin/users/:id` | Ubah user (`name`, `email`, `status`, `password` opsional). Ganti password -> trigger `PasswordChanged`; `status=INACTIVE` -> trigger `SessionRevoked` |
| GET | `/admin/users/:id/groups` | Group milik user |
| POST | `/admin/users/:id/groups` | Tambah user ke group `{groupId}` -> 204 |
| DELETE | `/admin/users/:id/groups/:groupId` | Keluarkan user dari group -> 204 |
| GET | `/admin/groups` | Daftar group |
| POST | `/admin/groups` | Buat group `{name, description?}` |
| PATCH | `/admin/groups/:id` | Ubah group |
| GET | `/admin/applications` | Daftar aplikasi (termasuk redirect URIs) |
| POST | `/admin/applications` | Buat aplikasi `{name, launchUrl?, logoutNotificationUrl, redirectUris[], status?}` -> 201, client secret hanya ditampilkan sekali |
| PATCH | `/admin/applications/:id` | Ubah aplikasi |
| GET | `/admin/applications/:id/policies` | Policy ALLOW aplikasi (per group) |
| POST | `/admin/applications/:id/policies` | Tambah policy `{groupId}` -> 201 |
| DELETE | `/admin/applications/:id/policies/:groupId` | Hapus policy -> 204 + emit `AccessPolicyChanged` (hanya ke app itu) |
| GET | `/admin/metrics/snapshot` | JSON snapshot metrics untuk dashboard |

## Control Panel (:3001)

- `GET /`: Frontend React SPA (Users, Groups, Applications, Policies, Metrics).
- `* /admin/*`: thin proxy ke `auth-server:3000` (menghindari CORS browser).

## App A (:4001) & App B (:4002)

| Method | Path | Deskripsi |
| :--- | :--- | :--- |
| GET | `/login` | Mulai SSO: generate PKCE + `state` (disimpan di `oauth_state`), redirect ke authorize endpoint |
| GET | `/callback` | Validasi state, tukar code, ambil userinfo, buat local session + profile cache, redirect home |
| GET | `/api/me` | Identitas + status local session (cookie `app_a_sid` / `app_b_sid`) |
| GET | `/api/activity-log` | 50 activity log terakhir app ini |
| GET | `/api/processed-events` | 50 processed events terakhir app ini |
| POST | `/api/logout` | Logout lokal (hanya sesi app ini) + clear cookie |
| POST | `/internal/logout` | Revoke local session dari event worker |

### `POST /internal/logout` (kontrak)

Header: `x-internal-signature` = HMAC-SHA256(`INTERNAL_HMAC_SECRET`,
timestamp + canonical event body), `x-internal-timestamp` = epoch detik
(maksimal selisih `INTERNAL_HMAC_TTL_SECONDS`).

Body: `{eventId, eventType, userId, centralSessionId?, applicationId?,
reason?}`; eventType `SessionRevoked` / `PasswordChanged` /
`AccessPolicyChanged`. Revoke local session + insert `processed_events`
dalam satu transaksi; event_id yang sudah diproses di-skip.

## Health probes (untuk B03)

Liveness = proses merespons (tanpa cek dependency). Readiness = dependency
sehat; `200 {"status":"ok","checks":{...}}` atau `503
{"status":"degraded","checks":{...}}` dengan nama komponen yang gagal.

| Service | Liveness | Readiness | Checks |
| :--- | :--- | :--- | :--- |
| auth-server | `GET /health/live` | `GET /health/ready` | `database` (postgres-primary `SELECT 1`), `broker` (RabbitMQ ping) |
| app-a / app-b | `GET /health/live` | `GET /health/ready` | `database` (postgres-local `SELECT 1`) |
| sync-worker | `GET :3002/health/live` | `GET :3002/health/ready` | `database` + `broker` |

`GET /health` tetap sebagai alias readiness (backward compatible) di
auth-server dan apps.

## Metrics (untuk B02)

| Method | Path | Deskripsi |
| :--- | :--- | :--- |
| GET | `/metrics` (auth-server) | Prometheus: `http_requests_total`, `http_request_duration_seconds`, `rabbitmq_queue_messages` (main/retry/DLQ), `outbox_pending_events` |
| GET | `/metrics` (sync-worker :3002) | Prometheus: `outbox_events_published_total`, `events_handled_total{result}`, `events_dead_lettered_total` |
| GET | `/admin/metrics/snapshot` (auth-server) | JSON untuk dashboard control panel |
