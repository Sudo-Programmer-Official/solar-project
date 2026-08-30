# Deployment

## Production topology

The MVP uses one web application, one API server, and one PostgreSQL database.

```text
browser ── HTTPS ── apps/web ── /api ── apps/api ── PostgreSQL
                                             ├── public
                                             ├── sales
                                             ├── analytics
                                             └── field_ops
```

The `/insights` page is part of `apps/web`; its dashboard, import, and drill-down requests are served by `apps/api`. No intelligence API, standalone intelligence web host, or worker process is required.

## Backend Environment

Required:

- `DATABASE_URL`
- `GOOGLE_SOLAR_API_KEY`
- `GOOGLE_GEOCODING_API_KEY`
- `CORS_ALLOWED_ORIGINS`
- `PORT` — the single API server port, normally `4000`.
- `AUTH_REQUIRED` — leave unset in production (secure default) or set `true`; only set `false` for a deliberately local demo.

Optional:

- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_NAME`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_SSL`
- `OBJECT_STORAGE_ENDPOINT`
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_ACCESS_KEY`
- `OBJECT_STORAGE_SECRET_KEY`
- `OBJECT_STORAGE_REGION` — defaults to `us-east-1`.
- `FIELD_BILL_SIGNING_SECRET` — a long, private secret used for five-minute bill links.

## Frontend Environment

Required:

- `VITE_API_BASE_URL`
- `VITE_AUTH_REQUIRED=true` — production web builds must use the API session; the demo role variables are only a local fallback when this is explicitly `false`.

Example local value:

- `http://localhost:4000`

## Notes

- The API binds to `0.0.0.0` and defaults to port `4000`.
- The web app binds to `0.0.0.0` and defaults to port `5173`.
- Production readiness is verified with `GET /health` and `GET /ready`.

## Private field-bill storage

Production requires an S3-compatible private bucket configured with all four
`OBJECT_STORAGE_*` values above. The API stores only an opaque object key in
PostgreSQL and never exposes a permanent public URL. An authorized user first
requests a five-minute signed download URL; the download endpoint still checks
the authenticated user's lead and bill permissions.

For local development, the API uses `.data/field-bills` unless
`FIELD_BILL_STORAGE_DIR` is set. That directory is intentionally ignored by
Git and is not a production storage option.

## Platform authentication

Migrations `009_platform_rbac.sql`, `010_platform_auth_scope.sql`, `011_field_operation_lifecycle.sql`, and `016_operational_slots.sql` create the normalized roles, permissions, sessions, invites, teams, audit tables, temporary-password state, closer availability, canonical appointment statuses, fixed operational slot definitions, and field activity/sync records in `field_ops`. Operational capacity is configured per fixed time by managers and is independent from closer availability. The API owns authorization; Vue navigation guards are only presentation.

Before the first production login, provision one administrator with the one-time CLI command below. It applies migrations and creates or resets the requested account without putting a password in source control:

```sh
PLATFORM_USER_EMAIL=admin@example.com \
PLATFORM_USER_PASSWORD='use-a-12-character-secret' \
PLATFORM_USER_FIRST_NAME=Platform \
PLATFORM_USER_LAST_NAME=Admin \
PLATFORM_USER_ROLES=SUPER_ADMIN \
npm run platform:create-user
```

The Team page then handles live user creation, multi-role assignment, invites, reactivation, and deactivation. A user created with a direct password is marked temporary and must replace it on first login; invite acceptance sets the user’s permanent password. In a separately hosted web/API deployment, keep the API on HTTPS: auth cookies use `SameSite=None; Secure` and the API must list the web origin in `CORS_ALLOWED_ORIGINS`.
