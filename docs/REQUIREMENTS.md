# ACME Salary Management — Scope Brief

## Goal

Give ACME’s HR manager a secure system to maintain salary records for 10,000 employees across 10 countries, analyze compensation and trace salary changes.

## Included

- Directory with server-side search, filters, sorting, pagination and filtered CSV export.
- Employee creation, profile editing and deactivation, preserving salary history.
- Salary updates with effective date and reason, atomically recorded with an attributed audit entry.
- Pay statistics by country, department, level and job title, with peer outlier analysis.
- Per-currency payroll totals and optional illustrative USD comparison.
- HR-manager authentication and role protection; a reproducible 10,000-record demonstration dataset.

## Excluded

- Live FX and salary conversion: avoid external accuracy risks; static rates are for comparison only and stored salaries are unchanged.
- Bulk import: validation and error recovery are outside the project workflow.
- Approvals, salary bands, planning, multiple roles and user administration: these require broader HR policies.
- SSO, password reset, rate limiting, notifications, real-time updates and mobile: outside the initial scope.

## Assumptions

- Salaries are annual.
- Employee country is work location; payroll currency is a separate attribute and is not inferred from country.
- Demo records are synthetic and contain no real personal data.
- The system analyzes compensation; it does not execute payroll or calculate payslips, taxes or deductions.

## Technical decisions

- PostgreSQL and Prisma store roster and salary history; grouped statistics run in SQL.
- Next.js serves the interface; NestJS provides the API.
- Salaries use decimal storage. Salary updates and related history, plus employee creation and opening history, are transactional.

## Acceptance criteria

- Authenticated HR managers can use directory, roster, history, analytics and export workflows; salary data is protected.
- Salary updates require a valid effective date and reason; salary, history and audit are written together or not at all.
- Totals are grouped by currency; peer comparisons match job title, country and currency.
- The deterministic 10,000-record dataset supports repeatable demos. Measure search and filtering against a one-second target on the seeded database.
