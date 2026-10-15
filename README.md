# ACME Salary Management

Web app for an HR manager to manage salaries for 10,000 employees across 10 countries and 4 currencies,
and to answer "how do we pay people?" without spreadsheets.

- **Directory** — server-side search, filters (country, department, level, currency, salary range), sorting, pagination, and CSV export of the matching view.
- **Roster** — add employees with an opening salary-history row, edit profile fields, and deactivate records without deleting their history.
- **Salary changes** — effective date + required reason, live % change, confirmation above 20%, atomic history + audit record.
- **Employee history** — who changed what, when and why; full salary timeline.
- **Pay insights** — median, middle 50% and range by country, department, level or job title; peer outliers; optional illustrative USD comparison.

| Read this | For |
|---|---|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Product goal, scope, assumptions, exclusions, and acceptance criteria |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Why the architecture and technical trade-offs were selected |
| [docs/AI_USAGE.md](docs/AI_USAGE.md) | AI-assisted work, engineering decisions, and verification record |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploying API, frontend and database |
| [docs/INSIGHTS_QUERIES.md](docs/INSIGHTS_QUERIES.md) | Analytics SQL, grouping rules, peer logic, and query verification |
| [docs/PROCESS.md](docs/PROCESS.md) | Project delivery workflow |

**Stack:** NestJS 10 · Prisma 6 · PostgreSQL 16 · Next.js 16 · React 19 · Radix UI · Tailwind · Jest.

## Architecture

```mermaid
flowchart LR
  HR[HR manager browser] -->|same-origin UI| UI[Next.js frontend]
  UI -->|/api proxy, session cookie| API[NestJS REST API]
  API -->|Prisma and SQL| DB[(PostgreSQL)]
  API -->|salary history and audit writes| DB
  CI[GitHub Actions] -->|lint, tests, migration, seed, build| API
  CI --> DB
```

The browser talks to the Next.js app; its `/api` proxy forwards authenticated requests to NestJS. PostgreSQL stores the roster, salary history and audit trail. See [the project delivery notes](docs/PROCESS.md) for the delivery workflow.

## Run locally

Prerequisites: Node 20+, npm, Docker (for PostgreSQL).

```bash
npm install --legacy-peer-deps
docker compose up -d postgres
cp backend/.env.example backend/.env    # then set JWT_SECRET, INITIAL_HR_EMAIL, INITIAL_HR_PASSWORD
npm run db:setup                        # migrations + 10,000 seeded employees
npm run auth:bootstrap --workspace backend
npm run dev
```

On Windows PowerShell use `Copy-Item backend/.env.example backend/.env`.

Generate a `JWT_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
`backend/.env.example` sets `NODE_ENV=development`, which the one-time HR-manager bootstrap requires.

Open http://localhost:3000 and sign in with the bootstrap credentials. The API runs on
http://localhost:4000/api; the frontend proxies `/api` to it (`API_PROXY_TARGET`, see `frontend/.env.example`).

The seed is deterministic (seeded PRNG) and idempotent: rerunning it skips existing employee codes.

## Test

```bash
npm run lint
npm test          # backend unit + HTTP tests, seed-generator tests, frontend component tests
npm run build
```

To generate HTML coverage reports, run Jest from each workspace:

```powershell
Push-Location backend
npx jest --runInBand --coverage
Pop-Location

Push-Location frontend
npx jest --runInBand --coverage
Pop-Location
```

Open `backend/coverage/lcov-report/index.html` and `frontend/coverage/lcov-report/index.html`. These generated reports are ignored by Git.

Integration tests run against a real, migrated PostgreSQL database (CI runs them on pushes to `main` and on pull requests). Use a
disposable database — the tests truncate tables:

```bash
docker compose exec postgres createdb -U salary_app salary_test
DATABASE_URL="postgresql://salary_app:salary_app@localhost:5433/salary_test?schema=public" npm run db:deploy --workspace backend
DATABASE_URL="postgresql://salary_app:salary_app@localhost:5433/salary_test?schema=public" npm run test:int --workspace backend
```

The Docker Compose database is published on host port `5433` (container port `5432`). In PowerShell, set the test database URL for each command like this:

```powershell
$env:DATABASE_URL = "postgresql://salary_app:salary_app@localhost:5433/salary_test?schema=public"
npm run db:deploy --workspace backend
npm run test:int --workspace backend
Remove-Item Env:DATABASE_URL
```

## API

All routes are under `/api`. Only `health`, `auth/login` and `auth/logout` are public; everything else needs an
HR-manager session cookie.

| Route | Purpose |
|---|---|
| `POST auth/login` · `POST auth/refresh` · `POST auth/logout` · `GET auth/me` | Session (15-min HttpOnly cookie, refreshed while active) |
| `GET health` | Readiness; 503 when the database is unreachable |
| `GET dashboard/summary` | Active headcount, payroll and average per currency, illustrative total in USD, countries, departments, levels |
| `GET employees` | `page, limit, search, country, department, level, currency, minSalary, maxSalary, sortBy, sortOrder` (salary bounds/sort need `currency`) |
| `GET employees/options` | Active countries, departments and job titles for employee roster forms |
| `POST employees` | Create a roster record and its opening salary-history row |
| `PATCH employees/:id` · `DELETE employees/:id` | Edit profile fields or soft-deactivate a record; profile edits cannot change salary or currency, and salary changes use the audited route |
| `GET employees/export` | CSV of every row matching the same filters |
| `GET employees/analytics` | Salary statistics by country, department, level or job title, grouped by currency; see [analytics notes](docs/INSIGHTS_QUERIES.md) for calculation and grouping rules |
| `GET employees/outliers` | Peer salary outliers; see [analytics notes](docs/INSIGHTS_QUERIES.md) for peer definitions and thresholds |
| `GET employees/:id` · `GET employees/:id/history` | Employee, salary timeline and attributed changes |
| `PATCH employees/:id/salary` | `{ salary, effectiveDate: "YYYY-MM-DD", reason, confirmLargeChange? }` |

Request validation errors and recognized database input/range errors return 400 responses. Deactivated employees are excluded from the directory, payroll totals, analytics, outliers and export; their salary history remains available through the history endpoint.

## Assessment delivery

The repository contains deployment instructions and CI, but no live deployment URL or recorded demo is committed. Add those to the submission after deploying with the hosting account you choose.

## Security notes
Passwords are bcrypt-hashed; sessions are short-lived HS256 JWTs in HttpOnly, SameSite=Strict cookies; every
request re-checks the user is an active HR manager. CSV export neutralises spreadsheet formulas. Not yet
implemented (needed before real data): rate limiting, SSO/password reset, server-side session revocation.
