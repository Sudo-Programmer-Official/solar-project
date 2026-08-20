# Deployment

## Production Topology

```text
browser
  ↓
web frontend
  ↓ HTTPS
API
  ↓
AWS RDS

API
  ↓
Google Geocoding
Google Solar
```

## Backend Environment

Required:

- `DATABASE_URL`
- `GOOGLE_SOLAR_API_KEY`
- `GOOGLE_GEOCODING_API_KEY`
- `CORS_ALLOWED_ORIGINS`
- `PORT`

Optional:

- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_NAME`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_SSL`

## Frontend Environment

Required:

- `VITE_API_BASE_URL`

Example local value:

- `http://localhost:4000`

## Notes

- The API binds to `0.0.0.0` and defaults to port `4000`.
- The web app binds to `0.0.0.0` and defaults to port `5173`.
- Production readiness is verified with `GET /health` and `GET /ready`.
