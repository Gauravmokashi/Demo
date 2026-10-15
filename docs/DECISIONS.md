# Design Decisions and Trade-offs

Short records of the choices that shaped the system. Each entry: context, decision, trade-off, and what I'd change at scale.

## D1. PostgreSQL + Prisma (not SQLite)
- **Context:** Needs aggregate queries (median, percentiles) and versioned schema changes.
- **Decision:** PostgreSQL 16 with Prisma migrations.
- **Trade-off:** Requires a hosted database for deployment, so setup is heavier than SQLite.
- **At scale:** Add read replicas or materialized views for insights if aggregates get slow.

## D2. Aggregates computed in SQL
- **Context:** The HR manager asks questions over all 10,000 rows (and growing).
- **Decision:** `GROUP BY` and `percentile_cont` run in the database. Nothing is aggregated in JS or the browser.
- **Trade-off:** Raw SQL for percentiles is less type-safe than the Prisma client.
- **Mitigation:** Isolate raw queries in one service and cover them with tests against a real Postgres.

## D3. Server-side pagination, filtering and search
- **Decision:** `skip`/`take` with a capped page size (max 100), and filters applied in the query.
- **Trade-off:** `contains` search can't use a normal B-tree index.
- **At scale:** Add a `pg_trgm` GIN index on name and code.

## D4. Money as DECIMAL, grouped by currency
- **Decision:** `DECIMAL(14,2)` storage. Totals and averages are per currency. Cross-currency views use an explicit, static rate table and never mutate stored salaries.
- **Trade-off:** JSON responses convert to JS `number`, so they're display-only, not for arbitrary-precision arithmetic.

## D5. Atomic salary change + history + audit
- **Decision:** One transaction updates the salary, inserts a `SalaryHistory` row and inserts a `SalaryChangeAudit` row with the actor.
- **Why:** Salary data is sensitive. A change without a record, or a record without a change, is worse than a failure.

## D6. Auth: JWT in HttpOnly cookie, role guard
- **Decision:** 15-minute HS256 token in an HttpOnly, SameSite=Strict cookie. The user and role are reloaded from the DB on every request.
- **Trade-off:** Stateless tokens can't be revoked before expiry (mitigated by the short lifetime and the `isActive` check).
- **Known gaps:** No rate limiting or CSRF token (documented, not hidden).

## D7. Separate API (NestJS) and UI (Next.js)
- **Decision:** Clear boundary between presentation and business logic.
- **Trade-off:** More setup than a single full-stack app, and two deployables.

## D8. CSV export neutralizes formula injection
- **Decision:** Cells starting with `=`, `+`, `-` or `@` are prefixed so they can't execute in a spreadsheet.
- **Why:** HR will open exports in Excel, and names or departments are text that could be hostile.

## D9. Testing strategy
- **Decision:** Fast unit tests with mocked Prisma for service logic. A small set of integration tests against real Postgres for filters, aggregates and the transaction.
- **Why:** Mocked tests prove logic but not SQL. The integration set covers the highest-risk queries.

## D10. Employee lifecycle
- **Decision:** New employees receive an opening salary-history row in the same transaction as their profile. Profile edits cannot change salary or currency; salary updates continue through the reasoned, audited route. Deactivation is a soft status change so salary history and audit references remain intact.
- **Trade-off:** This release has no reactivation or bulk-import workflow.

## D11. Pay outliers and USD comparison
- **Decision:** Compare employees only with peers sharing job title, country and currency. Require at least five active peers and flag values below 0.6× or above 1.5× the median. For the optional USD total, multiply local salaries by static USD multipliers: USD 1.00, EUR 1.08, GBP 1.27 and INR 0.012.
- **Trade-off:** The outlier thresholds and FX values are illustrative product defaults, not compensation policy or accounting rates. The UI labels the USD total as a comparison.

## Performance notes
- Indexes: country/department, currency/salary, full name, job title/country/currency for peer insights, employee active status, and history by employee/date.
- Seed inserts in batches of 1,000.
- No measured query timings are available yet. Record directory and insights timings on the seeded 10,000-row database before making a latency claim.
