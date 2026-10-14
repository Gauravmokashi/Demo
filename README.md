# ACME Salary Management System

This workspace contains a production-minded salary management monorepo for multinational payroll operations.

- NestJS backend with employee, payroll, and dashboard APIs
- Next.js dashboard for salary review and country-level HR monitoring
- Employee and payroll aggregation logic built around multi-currency totals
- HR-manager login with short-lived JWT cookie authentication and salary-change audit records

## Project structure

- `backend/` — NestJS API and test suite
- `frontend/` — Next.js dashboard UI

## Quick start

```powershell
npm install --legacy-peer-deps
docker compose up -d postgres
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
$env:NODE_ENV = 'development'
npm run db:setup
npm run auth:bootstrap --workspace backend
npm run dev
```

The frontend is served at `http://localhost:3000`; the NestJS API is at `http://localhost:4000/api`. The seed command adds 10,000 deterministic employees and skips existing employee codes, so it is safe to rerun.

Before bootstrap, set `JWT_SECRET`, `CORS_ORIGINS`, `INITIAL_HR_EMAIL`, and `INITIAL_HR_PASSWORD` in `backend/.env`. Use a unique `JWT_SECRET` of at least 32 bytes. The bootstrap command requires `NODE_ENV=development`, hashes the password, and never overwrites an existing account. Sign-in stores a short-lived JWT in an HttpOnly, SameSite=Strict cookie; it is Secure when `NODE_ENV=production`.

To run the services separately, use `npm run start:dev --workspace backend` and `npm run dev --workspace frontend`.

## API

- `POST /api/auth/login` — public HR-manager sign-in; sets an HttpOnly session cookie
- `GET /api/auth/me` — authenticated identity without password hash
- `POST /api/auth/logout` — clears the session cookie
- `GET /api/health` — public health response
- `GET /api/dashboard/summary` — workforce count and salary averages/totals grouped by currency
- `GET /api/employees` — filtered, server-paginated employee directory
- `GET /api/employees/analytics` — country and department metrics grouped by currency
- `GET /api/employees/export` — CSV export using the active filters
- `GET /api/employees/:id` — employee details
- `PATCH /api/employees/:id/salary` — validated salary update with salary-history entry

Employee salaries use PostgreSQL `DECIMAL(14,2)`. Payroll totals and average salaries are never combined across currencies.

All employee, dashboard, analytics, and export routes require an active HR-manager identity. Salary changes also create an actor-attributed audit record in the same database transaction as the salary update and history row. Apply the additive auth/audit migration with `npm run db:migrate --workspace backend`; do not reset a database containing other applications.

CSV export prefixes formula-leading values (`=`, `+`, `-`, `@`), including values preceded by whitespace/control characters, to reduce spreadsheet formula injection risk.

## Verification

```powershell
npm run lint
npm test
npm run build
```

GitHub Actions runs these checks on pull requests and pushes to `main`. It does not deploy the application.

## Notes

- Copy `backend/.env.example` to `backend/.env` and configure `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, and initial-manager values for local setup.
- The local compose file uses development credentials. Rate limiting, CSRF tokens/Origin enforcement, password reset, and production secret management are not implemented; do not expose this demo directly to the public internet.
- The frontend reads `NEXT_PUBLIC_API_URL` when set, defaulting to `http://localhost:4000/api`.
