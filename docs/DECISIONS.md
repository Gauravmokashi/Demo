# Design Decisions and Trade-offs

Records the implementation choices, their trade-offs, and selected scaling considerations.

## D1. PostgreSQL + Prisma (not SQLite)
- **Context:** Needs aggregate queries (median, percentiles) and versioned schema changes.
- **Decision:** PostgreSQL 16 with Prisma migrations.
- **Trade-off:** Requires a hosted database for deployment, so setup is heavier than SQLite.
- **At scale:** Measure query plans and timings on representative data first. Then tune indexes or consider precomputed/materialized aggregates; a read replica is only useful if the measured read workload justifies one.

## D2. Aggregates computed in SQL
- **Context:** The HR manager asks questions over all 10,000 rows (and growing).
- **Decision:** Grouped salary statistics (`COUNT`, `MIN`, quartiles, median, `AVG` and `SUM`) run in PostgreSQL. The optional illustrative USD payroll is calculated in the backend from the four per-currency totals returned by the database; no employee-level dataset is aggregated in the browser or application memory.
- **Trade-off:** Raw SQL for percentiles is less type-safe than the Prisma client.
- **Mitigation:** Isolate raw queries in one service and cover them with tests against a real Postgres.

## D3. Server-side pagination, filtering and search
- **Decision:** `skip`/`take` with a capped page size (max 100), and filters applied in the query.
- **Trade-off:** `contains` search can't use a normal B-tree index.
- **At scale:** Add `pg_trgm` GIN indexes for the text fields used by substring search (`employeeCode`, `fullName`, `jobTitle`, `department` and `country`) if measurements show the search is a bottleneck.

## D4. Money as DECIMAL, grouped by currency
- **Decision:** `DECIMAL(14,2)` storage. Totals and averages are per currency. Cross-currency views use an explicit, static rate table and never mutate stored salaries.
- **Trade-off:** JSON responses convert to JS `number`, so they're display-only, not for arbitrary-precision arithmetic.

## D5. Atomic salary change + history + audit
- **Decision:** One transaction locks the employee row, validates the effective date and large-change confirmation, updates the salary, inserts a `SalaryHistory` row and inserts a `SalaryChangeAudit` row with the actor.
- **Why:** Salary data is sensitive. A change without a record, or a record without a change, is worse than a failure.
- **Trade-off:** Scheduled salary changes are not supported. Effective dates must be today or earlier, and cannot precede the current salary's effective date.

## D6. Auth: JWT in HttpOnly cookie, role guard
- **Decision:** 15-minute HS256 token in an HttpOnly, SameSite=Strict cookie (`Secure` in production). The user and role are reloaded from the database on every request.
- **Trade-off:** There is no per-token revocation list. The guard rechecks the account's `isActive` status on every request, so disabling an account blocks its existing tokens.
- **Known gaps:** No login rate limiting or explicit CSRF token. The browser uses a same-origin API proxy and a `SameSite=Strict` cookie; revisit CSRF controls if that topology changes.

## D7. Separate API (NestJS) and UI (Next.js)
- **Decision:** Keep presentation and business logic behind a clear API boundary. The Next.js app proxies `/api` requests to NestJS so the browser uses one origin and the strict session cookie works across deployments.
- **Trade-off:** More setup than a single full-stack app, and two deployables.

## D8. CSV export mitigates formula injection
- **Decision:** CSV cells are quoted and escaped; an apostrophe is added when text begins with a formula marker (`=`, `+`, `-` or `@`), including when whitespace or control characters come first.
- **Why:** HR may open exports in spreadsheet software, and names or departments are text fields that could contain formula-like values. Tests cover the supported escaping behavior; CSV handling can vary between spreadsheet applications.

## D9. Testing strategy
- **Decision:** Fast unit and HTTP tests with mocked Prisma cover service and route behavior. A separate PostgreSQL integration suite exercises employee creation, roster edits and deactivation, salary transactions, grouped percentile analytics, level ordering, job-title grouping and peer outliers against a real database. Directory filters, search and CSV export are covered by the mocked suite, not the integration suite.
- **Why:** Mocked tests prove application logic but not PostgreSQL behavior. The integration suite targets the raw SQL and transactional writes with the highest database risk; CI is configured to run it.

## D10. Employee lifecycle
- **Decision:** New employees receive an opening salary-history row in the same transaction as their profile. Profile edits cannot change salary or currency; salary updates continue through the reasoned, audited route. Deactivation is a soft status change so salary history and audit references remain intact.
- **Trade-off:** This release has no reactivation or bulk-import workflow.

## D11. Pay outliers and USD comparison
- **Decision:** Provide peer-relative outlier signals and an optional USD comparison. The exact peer rules and comparison rates are documented in [`INSIGHTS_QUERIES.md`](INSIGHTS_QUERIES.md).
- **Trade-off:** These thresholds and rates are illustrative product defaults, not compensation policy or accounting rates.

## D12. Country and payroll currency
- **Decision:** Store work country and payroll currency separately, as defined in the assumptions in [`REQUIREMENTS.md`](REQUIREMENTS.md). The API does not infer one from the other.
- **Trade-off:** Payroll arrangements vary by location and employer, so compensation reporting groups amounts by currency.

## D13. Hire date and salary effective dates
- **Decision:** An opening salary and each later salary change must take effect on or after the employee's hire date. Profile edits cannot move the hire date past the current salary effective date.
- **Why:** This prevents a salary history that predates employment and avoids invalidating the current compensation timeline.

## Performance notes
- Indexes: country/department, currency/salary, full name, level, job title/country/currency for peer insights, employee active status, salary history by employee/effective date, and audit history by actor/change date and employee/change date.
- Seed inserts in batches of 1,000.

### Local endpoint benchmark (2026-10-16)

Measured against the local PostgreSQL database containing all 10,000 deterministic seed-code records (`ACM-00001`–`ACM-10000`) plus two additional employee rows: 10,002 total, 10,001 active. This is close to, but not an exact 10,000-row snapshot.

**Environment:** Windows `10.0.26200`, Intel Core i7-8565U at 1.80 GHz (8 logical cores); Node.js 23.9.0, NestJS 10.4.22; PostgreSQL 16.15 in Docker. The API was started locally with `ts-node/register/transpile-only`; TypeScript type checking was bypassed for this runtime measurement.

**Method:** Five warm-up requests, then 50 sequential authenticated requests per endpoint from the same machine. Latency includes local HTTP request/response, response-body transfer and JSON parsing. Median is the conventional median of the sorted samples; p95 uses nearest rank.

| Endpoint and query | Result size | Runs | Median | P95 |
|---|---:|---:|---:|---:|
| `GET /api/employees?page=1&limit=25&search=maya&country=India` | 76 matches (25 returned) | 50 | 39.59 ms | 75.00 ms |
| `GET /api/employees/analytics?dimension=country` | 11 groups | 50 | 24.84 ms | 44.39 ms |

These are single-machine local observations, not production latency guarantees. The sub-second directory response remains a target for other datasets and deployment environments.
