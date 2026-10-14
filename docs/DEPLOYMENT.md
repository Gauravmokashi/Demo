# Deployment

The browser only talks to the Next.js app. Next.js proxies `/api/*` to the NestJS API
(`API_PROXY_TARGET`), so the `SameSite=Strict` session cookie works even when the two run on different hosts.

## Any Node host (e.g. Render, Railway, Fly.io)

**Database:** a managed PostgreSQL 16 instance. Copy its connection string.

**API service** (repository root as the working directory — it is an npm workspace):

| Setting | Value |
|---|---|
| Build | `npm ci --legacy-peer-deps && npm run prisma:generate --workspace backend && npm run build --workspace backend` |
| Pre-deploy | `npm run db:deploy --workspace backend` (applies committed migrations; never resets data) |
| Start | `npm run start:prod --workspace backend` |
| Health check | `GET /api/health` (returns 503 when the database is unreachable) |
| Env | `DATABASE_URL`, `JWT_SECRET` (≥ 32 random bytes), `CORS_ORIGINS` (the frontend URL), `NODE_ENV=production` |

One-off after the first deploy (from your machine, pointing `DATABASE_URL` at the new database):
```bash
npm run db:seed --workspace backend
NODE_ENV=development INITIAL_HR_EMAIL=... INITIAL_HR_PASSWORD=... npm run auth:bootstrap --workspace backend
```

**Frontend service** (repository root as the working directory, or Vercel with root directory `frontend`):

| Setting | Value |
|---|---|
| Build | `npm ci --legacy-peer-deps && npm run build --workspace frontend` |
| Start | `npm run start --workspace frontend` |
| Env | `API_PROXY_TARGET` = the API's public origin, e.g. `https://acme-salary-api.onrender.com` (no `/api`) |

`API_PROXY_TARGET` is read at build time by `next.config.mjs`; redeploy the frontend if it changes.

## Checklist before real salary data
TLS everywhere, secrets in the platform's secret store, rate limiting on `/api/auth/login`, SSO or password
reset, backups and point-in-time recovery on the database, and log shipping for the API.
