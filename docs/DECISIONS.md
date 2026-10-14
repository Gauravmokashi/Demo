# Design decisions, trade-offs and performance

## Architecture
```mermaid
flowchart LR
  HR[HR manager browser] -->|same origin /api| NEXT[Next.js app]
  NEXT -->|rewrite proxy| API[NestJS API]
  API --> G[JWT cookie guard + HR role guard]
  G --> C[Controllers + DTO validation]
  C --> S[EmployeesService]
  S --> P[(PostgreSQL via Prisma)]
```

| Decision | Alternatives | Why |
|---|---|---|
| NestJS + Prisma + PostgreSQL | SQLite, raw SQL | Postgres gives `DECIMAL`, row locks and `percentile_cont`; Prisma gives typed queries and migrations |
| Money as `DECIMAL(14,2)`, never summed across currencies | Floats; convert to USD | Exactness; FX is out of scope (see REQUIREMENTS) |
| Currency fixed by the employee record | Editable currency | A currency change is a relocation event, not a raise; silently changing it corrupted history |
| Effective date must be ≤ today and ≥ current effective date | Allow any date | Back-dating rewrote "current salary" from an older record; future dates need scheduling |
| >20% changes need `confirmLargeChange` (API **and** UI) | UI-only warning | The API is the source of truth; scripts can't bypass the guard |
| Reason required on every change | Optional note | An audit row without "why" doesn't answer HR's real question |
| Salary filters/sorting require a currency | Compare raw numbers | INR 50,000 ≠ USD 50,000; the API returns 400 rather than a misleading result |
| Analytics via one whitelisted raw SQL query | Prisma `groupBy` | `groupBy` has no median/percentiles; the dimension is mapped to a fixed column identifier, values are parameterised |
| Same-origin `/api` via Next.js rewrite | Direct cross-origin calls | `SameSite=Strict` cookies are not sent cross-site, so a Vercel + Render split would break login |
| 15-min JWT + sliding refresh while active | Long-lived token; server sessions | Short exposure window; active users aren't logged out mid-edit; idle screens sign out |
| Radix UI primitives + Tailwind | MUI, Mantine | Accessible dialog/tabs (focus trap, keyboard) without fighting an existing visual design |
| Seeded PRNG for seed data | Index arithmetic; faker | Realistic, reproducible; no extra dependency; generator is pure and unit-tested |

## Performance (10,000 employees)
- **Directory:** server-side `count` + `skip/take` (≤100 rows/page). Indexes on `(country, department)`,
  `(currency, salary)`, `fullName`, `level`. Search is `ILIKE '%term%'`, a sequential scan — cheap at
  10k rows. At ~1M rows add a `pg_trgm` GIN index and switch to keyset pagination.
- **Summary/insights:** single aggregate queries; `percentile_cont` over 10k rows is cheap.
- **Salary update:** one transaction with `SELECT … FOR UPDATE` so concurrent edits of the same employee
  serialise instead of losing an update or writing a wrong "previous salary" to the audit.
- **CSV export:** builds all matching rows in memory (~1.5 MB for 10k). Fine here; stream with a cursor
  beyond ~100k rows.
- **Frontend:** search is debounced (180 ms) and stale requests are aborted, so typing never races.

## Testing strategy
| Layer | Tool | What it proves |
|---|---|---|
| Service unit tests | Jest, mocked Prisma | Business rules: pagination, sorting, date/size rules, audit content, CSV escaping |
| HTTP tests | Supertest, mocked Prisma | Auth, roles, DTO validation, error mapping, CSV response body |
| Integration | Jest + real PostgreSQL (CI) | Raw SQL, row lock + transaction atomicity, percentile maths, enum ordering |
| Seed generator | Jest | Determinism, uniqueness, every country×department pair exists, pay rises with level |
| UI | React Testing Library | Login/expiry, filters/sort/pagination requests, salary dialog rules, history, insights |
