# How I Used AI

AI was used for planning, documentation and implementation support. The notes below distinguish the original author-reported use of Claude from the Codex work recorded in this project-completion session.

## Tools
- **Claude (chat):** assignment breakdown, stack comparison, review of my project documentation, and first drafts of the docs and SQL under `docs/`.
- **OpenAI Codex:** reviewed the repository against the assessment and implemented employee roster create/edit/deactivate, job-title analytics, peer outlier reporting, illustrative USD payroll comparison, related tests, and documentation updates in this session.

## Workflow

1. **Understanding the brief.** I shared the assessment document and asked for a breakdown of what was being evaluated. The main takeaway was that the persona (an HR manager) needs to *answer questions about how the org pays people*, so analytics matter as much as CRUD.
2. **Choosing the stack.** The project uses NestJS, Next.js, Prisma and PostgreSQL. The recorded decisions explain the relational model, PostgreSQL percentile queries and separate API/UI boundary.
3. **Reviewing my own work against the brief.** I shared my technical documentation and asked what to improve for an interview submission. The review found real gaps, listed below.
4. **Closing the gaps.** The repository includes requirements and design notes. Codex checked the proposed insights against the current Prisma schema, then implemented the missing roster and pay-insight paths instead of leaving SQL sketches as future work.
5. **Implementation and tests.** Codex updated the API, UI, schema migration, unit tests, PostgreSQL integration tests and component tests. The tests were added but were not run during this session; the CI workflow is configured to run lint, tests, migrations, a 10,000-row seed and build.

## Prompts I used

### Prompt 1: Choosing the stack
```
which stack is perfect for this project?
```
**Result:** A recommended stack with reasons and alternatives I should reject (NestJS as heavy, Postgres as extra setup, and so on).
**What I changed:** Chose the stack now present in the repository and recorded its trade-offs in `docs/DECISIONS.md`.

### Prompt 2: Honest rating of the approach
```
what will you rate if build by above stack. out of 10?
```
**Result:** A rating of about 8.5/10 for the stack, with the explanation that the stack decides only part of the grade and the rest is execution: requirements, insights, tests, commits and deployment.
**What I changed:** Treated the rating as feedback about the stack, then focused the implementation on the assessment's end-to-end functionality and evidence.

### Prompt 3: Reviewing my own documentation
```
[attached my technical documentation] is there anything needs to be change?
considering interview assignment what needs to improve? how much you will rate this?
```
**Result:** About 6.5/10 with a concrete list of gaps: no one-page requirements doc, no deployment, thin insights (only count/sum/average), no employee create/edit, no cross-currency comparison, and no documentation of AI usage. It also flagged a contradiction in my doc about CSV formula protection, unused dependencies, `--legacy-peer-deps`, and tests that only use mocked Prisma.
**What I changed:** Added the requirements and design records, deployment instructions, PostgreSQL integration coverage, and this AI-use record. The completion work in this session added employee lifecycle routes, job-title analytics, peer outliers, static USD comparison and corresponding tests.

### Prompt 4: Requirements first
```
1st requirements doc
```
**Result:** A one-page requirements doc (goal, features in scope, what is deliberately left out and why, trade-offs, success criteria).
**What I changed:** Kept the original product goal and documented explicit exclusions such as payroll execution, live FX rates, bulk import and approval workflows.

## Where AI needed correction or care
- The earlier review was based on documentation. Codex then inspected the implementation and found that the SQL notes described job-title analytics, outliers and FX before those features existed. The implementation now uses the actual Prisma schema and a migration; the test suite was extended, but was not executed in this session.
- Static FX values are illustrative only. The stored salary and currency are not converted, and the UI labels the USD total accordingly.

## What I did not delegate
- Scope: which features to build and which to leave out, and the reasoning for each.
- Security and operational trade-offs (JWT cookie auth, no rate limiting, static FX rates).
- The implementation keeps salary edits separate from profile edits so salary changes continue to require a reason and create both history and audit rows.

## How I kept quality high
- The repository has incremental commits and a CI workflow for lint, unit/component tests, PostgreSQL integration tests, a 10,000-employee seed and build. This session's test cases were added but not run; the local dependencies are not installed.
- No `EXPLAIN ANALYZE` timings or live deployment are claimed in this record.
