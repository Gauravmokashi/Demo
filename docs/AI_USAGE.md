# AI Use and Development Log

## 1. Overview

I used Claude and OpenAI Codex to assist with implementation, code review, debugging, testing, and documentation for the ACME Salary Management application.

The goal was to build a web application that enables an HR manager to manage 10,000 employees, maintain salary history, and understand compensation distribution across countries and currencies.

AI was used as a development assistant, not as the final authority. I reviewed the proposed implementation against the application requirements, database schema, API behavior, and test code. I made the final decisions on feature scope, architecture, trade-offs, and acceptance criteria.

**Prompt provenance:** The prompts below are reconstructed examples organized around the project's implementation stages. The original implementation prompt history was not retained, so these examples must not be interpreted as verbatim historical prompts.

## 2. AI-Assisted Development Workflow

### Stage 1 — Review the existing implementation and assessment

**Objective:** Identify gaps between the application and the interview assignment.

**Reconstructed prompt:**

> Review the existing salary management application against the assessment requirements. Inspect the source code, database schema, API endpoints, UI, tests, and documentation. Identify missing features, implementation risks, unsupported claims, and the highest-priority improvements. Separate confirmed findings from assumptions. Do not recommend adding complexity without a clear product or engineering benefit.

**AI contribution:** Helped identify gaps in employee lifecycle management, compensation insights, testing, documentation, and submission readiness.

**Engineering decision:** Prioritized features directly related to the HR manager's workflow and avoided expanding the application into a full payroll or HR platform.

### Stage 2 — Establish application architecture

**Objective:** Organize the frontend, backend, database, and development workflow.

**Reconstructed prompt:**

> Review the existing project structure and recommend a maintainable architecture for a salary management application supporting 10,000 employees. Use the existing React/Next.js frontend, NestJS backend, Prisma ORM, and PostgreSQL database where appropriate. Keep responsibilities separated, validate API inputs, use database constraints for integrity, and avoid unnecessary abstraction. Explain the trade-offs before suggesting structural changes.

**AI contribution:** Assisted with architecture review, module boundaries, API organization, database access patterns, and maintainability improvements.

**Engineering decision:** Retained a relational database for structured employee and salary data, database-backed filtering and analytics, and a separate frontend/backend structure.

### Stage 3 — Employee data model and seed generation

**Objective:** Support a realistic dataset of 10,000 employees.

**Reconstructed prompt:**

> Review the Prisma schema and employee seed implementation. Ensure the data model supports employee identity, job title, department, country, employment status, salary amount, currency, and salary history as required by the existing application. Generate 10,000 deterministic synthetic employees using a fixed seed, valid relationships, realistic distributions, and batched database inserts. Make the seed safe to rerun and report any assumptions or limitations.

**AI contribution:** Assisted with schema review, deterministic synthetic-data generation, seed validation, and database setup documentation.

**Engineering decision:** Used synthetic employee data rather than real personal or compensation records. Kept salary amounts associated with their currencies instead of treating all monetary values as directly comparable.

### Stage 4 — Authentication and authorization

**Objective:** Protect HR management functionality.

**Reconstructed prompt:**

> Review the existing NestJS authentication implementation. Check password hashing, credential validation, JWT handling, cookie settings, current-user validation, role guards, and authorization on protected endpoints. Identify concrete security weaknesses and recommend minimal, maintainable fixes. Do not claim production security without evidence.

**AI contribution:** Assisted with security review and validation of authentication and authorization behavior.

**Engineering decision:** Retained the implemented authentication controls and documented security features that remain outside scope, including SSO, password reset, login rate limiting, and server-side token revocation.

### Stage 5 — Employee management APIs

**Objective:** Implement the employee lifecycle.

**Reconstructed prompt:**

> Review the employee API and service layer. Implement or improve employee creation, profile editing, deactivation, search, filtering, sorting, and pagination according to the existing schema and requirements. Validate request inputs, use an allowlist for sortable fields, enforce reasonable page-size limits, and handle missing records and duplicate employee identifiers. Keep database operations efficient for 10,000 employees and add tests for success and failure cases.

**AI contribution:** Assisted with service implementation, DTO validation, query handling, error cases, and corresponding tests.

**Engineering decision:** Kept profile editing separate from salary changes and used database-side filtering and pagination rather than loading all employees into application memory.

### Stage 6 — Salary changes and audit history

**Objective:** Preserve salary-change traceability and data integrity.

**Reconstructed prompt:**

> Review the salary update workflow. Ensure that a salary change validates the amount, currency, effective date, and required reason according to the existing business rules. Preserve salary history and audit attribution. Use a database transaction so the salary update, history entry, and audit record succeed or fail together. Review concurrent-update behavior and add tests for validation failures and transaction-related cases. Do not silently overwrite historical salary records.

**AI contribution:** Assisted with transaction review, salary-history handling, audit logging, validation, and test design.

**Engineering decision:** Used transactional writes and employee-row locking in the salary-update path. Kept salary changes auditable instead of treating compensation as an ordinary profile field.

### Stage 7 — Compensation insights

**Objective:** Help HR answer questions about how the organization pays employees.

**Reconstructed prompt:**

> Review the existing compensation analytics implementation. Support grouping by the available organizational dimensions, with compensation statistics including employee count, minimum, maximum, average, median, P25, and P75 where implemented. Preserve currency separation and validate grouping and filtering inputs. Review the peer-group outlier logic, minimum peer-group size, and configurable thresholds. Use database-side aggregation where appropriate and add deterministic tests for edge cases.

**AI contribution:** Assisted with analytics query review, percentile calculations, grouping rules, outlier logic, and related tests and documentation.

**Engineering decision:** Kept analytics database-backed, separated currencies, and compared employees within the implemented peer-group dimensions. Treated outlier thresholds as configurable defaults rather than established HR policy.

### Stage 8 — Currency comparison and CSV export

**Objective:** Provide useful reporting without misleading HR users.

**Reconstructed prompt:**

> Review the compensation comparison and CSV export features. Verify that monetary values retain their original currency and that any USD-normalized comparison clearly identifies the conversion assumptions. Check CSV handling for formula injection and ensure exported data follows the same filters and access rules as the relevant API. Add tests for special characters, empty values, and edge cases.

**AI contribution:** Assisted with export-safety review, comparison behavior, and documentation of limitations.

**Engineering decision:** Kept static FX rates illustrative rather than presenting them as live market or accounting rates. Treated CSV formula-injection protection as a security requirement.

### Stage 9 — Frontend implementation and integration

**Objective:** Connect the HR workflows to a usable interface.

**Reconstructed prompt:**

> Review the Next.js frontend against the implemented backend API. Ensure the employee directory supports the available search, filtering, sorting, and pagination behavior. Review employee create/edit/deactivate flows, salary-change forms, validation feedback, salary history, compensation insights, and CSV export. Handle loading, empty, error, and unauthorized states. Avoid duplicating business rules in the UI when the backend must enforce them.

**AI contribution:** Assisted with component implementation, API integration, form validation, user feedback, and frontend test coverage.

**Engineering decision:** Kept authoritative validation and business rules in the backend, using the frontend to present the workflows and communicate API responses.

### Stage 10 — Testing and debugging

**Objective:** Improve correctness without confusing test presence with verified behavior.

**Reconstructed prompt:**

> Review the existing tests and identify missing high-value cases for authentication, employee lifecycle operations, salary updates, history and audit integrity, CSV export, seed generation, and compensation analytics. Prefer fast, deterministic unit tests with mocks where appropriate. Keep database integration tests separate. Do not change expected results merely to make tests pass. Explain what each test proves and what remains unverified.

**AI contribution:** Assisted with identifying test gaps, adding test cases, debugging implementation issues, and reviewing expected behavior.

**Engineering decision:** Distinguished unit-test coverage from database integration, browser-level end-to-end testing, and performance benchmarking. Test files alone were not treated as evidence of successful execution.

### Stage 11 — Documentation and final review

**Objective:** Align documentation with the actual implementation.

**Reconstructed prompt:**

> Audit the README and project documentation against the current source code, Prisma schema, API routes, test files, scripts, and Git history. Identify contradictory statements, planned features described as implemented, unsupported performance or security claims, and incorrect setup commands. Keep the requirements brief concise, explain deliberate exclusions, and document unverified items honestly. Do not invent test results, deployment URLs, benchmark measurements, or historical prompts.

**AI contribution:** Assisted with documentation review, consistency checks, architecture explanations, setup instructions, and identifying unsupported claims.

**Engineering decision:** Preserved the actual development chronology: the requirements document was written retrospectively, after the initial working application. Deployment and demo recording remain outstanding; a local benchmark is recorded in `DECISIONS.md`.

## 3. Verification and Evidence

AI-generated suggestions were reviewed against the implementation and available tests. The following evidence must be interpreted according to the exact revision being examined.

| Check | Recorded status |
|---|---|
| Source and schema review | Performed during development and documentation review |
| Test suite | An attempted `npm test` run stopped because Jest was unavailable in the environment |
| Build and lint | Not verified for the exact uncommitted snapshot |
| PostgreSQL integration tests | Not verified for the exact uncommitted snapshot |
| Local API performance | Benchmarked over 50 requests per endpoint against 10,002 employee rows; details in `DECISIONS.md`. Not an exact 10,000-row snapshot or production benchmark. |
| Deployment and demo recording | Not included in the reviewed snapshot |

The reviewed working tree contained uncommitted changes based on commit `283c022f691e9ee09a7d0f063767a062dded64d8`. Therefore, the recorded checks do not establish that the complete final working tree passed.

A successful CI run for a committed revision is evidence for that revision only; it must not be generalized to later uncommitted changes.

## 4. What I Deliberately Did Not Delegate to AI

- Final product scope and prioritization.
- Acceptance of architectural and data-integrity trade-offs.
- Decisions about currency interpretation and compensation policy.
- Approval of security and performance claims.
- Interpretation of test results and readiness for submission.

AI accelerated implementation and review, but the application was not considered correct simply because AI suggested a solution or generated a test.

## 5. Known Limitations

The reviewed submission does not include a live deployment URL or recorded demo. Live FX integration, payroll execution, SSO, password reset, login rate limiting, and server-side token revocation are outside the current scope.

Refer to [DECISIONS.md](DECISIONS.md) for architectural trade-offs and performance status.

## 6. Summary

The intended workflow was to use AI to accelerate implementation and review while retaining responsibility for engineering decisions and verification. The most important principle was to treat AI output as a proposal, validate it against the actual system, and document limitations instead of overstating completion or correctness.
