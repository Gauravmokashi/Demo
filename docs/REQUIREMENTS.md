ACME Salary Management: Requirements

Persona: HR Manager at ACME (10,000 employees, multiple countries) Status: Written before building; updated as scope decisions changed.

1. Goal

Replace the Excel-based salary process with a web app where the HR manager can maintain salary data and answer questions about how the org pays people, quickly and without spreadsheet gymnastics.

Questions the product must answer in under a minute:

What do we pay by country, department and job title (min / median / avg / max)?
What is our total payroll, and how is it split across countries and currencies?
Who is paid unusually high or low compared with their peer group?
When did someone's salary last change, and who changed it?
2. Scope and Features (in)
#	Feature	Why
1	Employee directory with server-side search, filters (country, department, currency, salary range) and pagination	10k rows can't be loaded client-side; this is the daily-use screen
2	Salary update with effective date	Core write action replacing manual Excel edits
3	Salary history + audit trail (who, old to new, when), written atomically with the update	Salary data is sensitive; every change must be traceable
4	Pay insights: headcount, min / median / avg / max by country, department and job title; outlier view	This is what lets HR "answer questions about how the org pays"
5	Per-currency totals, with an optional "show in USD" view using a static rate table	Multi-country org: raw sums across currencies are meaningless
6	Employee create / edit / deactivate; new records get an opening salary-history row and deactivation preserves history	HR must be able to keep the roster current without erasing compensation records
7	CSV export of the current filtered view	Smooth transition: HR still shares data in spreadsheets
8	HR-manager login (JWT in HttpOnly cookie, role guard)	Salary data must not be public once deployed
9	Seed script: deterministic, 10,000 employees	Reproducible demo and performance testing
3. Deliberately Left Out (and why)
Not building	Reasoning
Payroll runs, payslips, tax and deductions	Different problem (paying people vs. understanding pay); large and compliance-heavy
Live FX rates / FX-based salary conversion on edit	External dependency and accuracy concerns; a static rate table is enough for comparison. Stored salary is never altered
Multiple roles, SSO, user-management UI	Persona is a single HR manager; one bootstrapped account keeps the surface small
Bulk Excel/CSV import	Valuable for migration, but a one-time task better handled by the seed/migration script than a UI that needs error-row handling
Approval workflows, salary bands and compensation planning	Needs HR process input I don't have; the audit trail covers accountability for now
Password reset, rate limiting, token revocation	Production hardening; documented as known gaps, not needed to demonstrate the product
Real-time updates, notifications, mobile app	No evidence the persona needs them
4. Key Decisions and Trade-offs
PostgreSQL + Prisma: relational data and aggregate queries (median, percentiles) fit SQL; migrations are versioned. Trade-off: needs a hosted DB for deployment.
Aggregates computed in the database, never in the browser or app memory, to stay fast at 10k rows and beyond.
Money stored as DECIMAL, grouped by currency, and never summed across currencies without an explicit conversion step.
Next.js UI + NestJS API, kept separate: a clear boundary between UI and business logic, at the cost of more setup than a single full-stack app.
5. Success Criteria
Directory search and filters respond in well under 1 second on 10,000 rows.
Every salary change produces a history row and an audit row, or neither (atomic); new employee creation and its opening salary-history row are also atomic.
Core logic (roster lifecycle, filters, aggregates, peer outliers, salary update, auth, USD conversion and CSV safety) is covered by deterministic tests.
The app is deployed, seeded and demonstrable end to end.
6. Assumptions
Salaries are annual, in the employee's local currency (USD, EUR, GBP, INR).
Data is synthetic; no real PII is involved.
One HR manager account is enough for this release.
