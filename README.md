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
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Goal, scope, and what is deliberately left out |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architecture, trade-offs, performance, testing strategy |
| [docs/AI_USAGE.md](docs/AI_USAGE.md) | How AI tools were used and checked |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploying API, frontend and database |
| [docs/INSIGHTS_QUERIES.md](docs/INSIGHTS_QUERIES.md) | Analytics behavior and peer outlier rules |

**Stack:** NestJS 10 · Prisma 6 · PostgreSQL 16 · Next.js 16 · React 19 · Radix UI · Tailwind · Jest.

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

Integration tests run against a real, migrated PostgreSQL database (CI does this on every push). Use a
disposable database — the tests truncate tables:

```bash
docker compose exec postgres createdb -U salary_app salary_test
DATABASE_URL="postgresql://salary_app:salary_app@localhost:5432/salary_test?schema=public" npm run db:deploy --workspace backend
DATABASE_URL="postgresql://salary_app:salary_app@localhost:5432/salary_test?schema=public" npm run test:int --workspace backend
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
| `POST employees` | Create a roster record and its opening salary-history row |
| `PATCH employees/:id` · `DELETE employees/:id` | Edit profile fields or soft-deactivate a record; salary and currency remain on their audited workflow |
| `GET employees/export` | CSV of every row matching the same filters |
| `GET employees/analytics` | `dimension=country\|department\|level\|jobTitle`, optional `country, department, currency` → count, min, P25, median, P75, max, average, total per group and currency |
| `GET employees/outliers` | Salaries outside 0.6×–1.5× of a peer median, for groups of at least five |
| `GET employees/:id` · `GET employees/:id/history` | Employee, salary timeline and attributed changes |
| `PATCH employees/:id/salary` | `{ salary, effectiveDate: "YYYY-MM-DD", reason, confirmLargeChange? }` |

Invalid input returns 400 with a message (including database range errors), never a 500. Deactivated employees are excluded from the directory, payroll totals, analytics and export; their salary history stays available in the database.

## Assessment delivery

The repository contains deployment instructions and CI, but no live deployment URL or recorded demo is committed. Add those to the submission after deploying with the hosting account you choose.

## Security notes
Passwords are bcrypt-hashed; sessions are short-lived HS256 JWTs in HttpOnly, SameSite=Strict cookies; every
request re-checks the user is an active HR manager. CSV export neutralises spreadsheet formulas. Not yet
implemented (needed before real data): rate limiting, SSO/password reset, server-side session revocation.
