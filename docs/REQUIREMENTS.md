# Requirements — ACME Salary Management

> Written as a one-page product brief. Note: v1 was built before this document existed; it was written
> during the review pass (see [PROCESS.md](PROCESS.md)) and the scope below is what the current build delivers.

## Goal
Replace the spreadsheets ACME's HR team uses to manage salaries for **10,000 employees across 10 countries and
4 currencies** with a web app where an HR manager can (1) find and update any employee's salary safely and
(2) answer "how do we pay people?" without exporting to Excel.

## User
**HR manager** (single persona). Comfortable with spreadsheets, not with SQL. Needs speed for routine
lookups, confidence that changes are correct and attributable, and quick answers for leadership questions.

## Questions the product must answer
1. What does *this person* earn, since when, and who changed it last and why?
2. What is our payroll and average pay per currency?
3. How is pay spread within a country / department / level (median, middle 50%, range)?
4. Who earns within a given band (e.g. USD 100k–150k engineers in the US)?
5. Can I get this as a file for finance? (CSV export of exactly what I filtered)

## Scope & features
| Area | Feature | Why |
|---|---|---|
| Directory | Server-side search (name, ID, title, department, country), filters (country, department, level, currency, salary range), sortable columns, pagination | 10k rows is too many for the browser; HR finds people by many attributes |
| Salary change | Edit salary with effective date and **required reason**; live old→new and % change; >20% changes need explicit confirmation | Prevents typos and makes every change explainable |
| Integrity | Change, history row and audit row written in one transaction; no back-dating before the current effective date; no future dates | Audit trail must be trustworthy |
| History | Per-employee panel: current facts, attributed change log, salary timeline | Answers question 1 without a database |
| Insights | Pay distribution by country / department / level, filterable by country and currency (median, P25–P75, min–max, total) | Answers questions 2–4 |
| Export | CSV with the directory's filters, formula-injection safe | Finance still lives in spreadsheets |
| Access | HR-manager sign-in, 15-min sliding session, HttpOnly cookie | Salary data is sensitive |

## Deliberately out of scope (and why)
- **Currency conversion / org-wide totals in one currency** — FX rates need a source of truth, a date policy and
  sign-off from finance; showing a converted number that is wrong is worse than showing none. Every figure stays
  in its own currency.
- **Scheduled (future-dated) changes** — needs a job to apply them and UI to cancel them; rejected explicitly for now.
- **Employee create/terminate, relocation/currency change** — HRIS owns the employee lifecycle; this tool manages pay.
- **Approval workflows, multiple roles, employee self-service** — single persona; the >20% confirmation and
  audit log cover the main risk for v1.
- **Bonus, equity, benefits, pay bands** — base salary first; bands are the natural next step (data model has level).
- **Bulk import from Excel** — valuable for migration but needs validation/preview UX; seed script stands in.
- **SSO, password reset, rate limiting** — required before production, not needed to evaluate the product.

## Success criteria
- Find any employee and see their pay history in < 10 seconds.
- A salary change cannot be saved without a reason, and every change shows who/when/why.
- Leadership questions 2–4 answered on one screen, without export.
