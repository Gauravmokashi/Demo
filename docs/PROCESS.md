# How this solution evolved

1. **v1 (commit `89d7267`, "Done")** — the first working version landed in one large commit: NestJS API,
   Next.js dashboard, Prisma/PostgreSQL schema, HR auth with salary audit, deterministic seed, unit tests.
   *Lesson:* this hid the design evolution the assessment asks to see; later work was committed with a full
   explanation of what changed and why.
2. **Review pass** — an AI-assisted review of the code against the assessment brief found:
   - a real bug (CSV export sent `{}` because the async service result was not awaited — no test covered it),
   - unvalidated inputs that became 500s (export filters, timestamp effective dates, salary overflow),
   - salary changes that ignored effective-date ordering and allowed silent currency changes,
   - seed data whose index arithmetic produced only 20 distinct names and no employees for half of all
     country × department pairs, making analytics meaningless,
   - an analytics endpoint the UI never used, so the core question ("how do we pay people?") was unanswered,
   - missing artifacts (requirements, decisions, AI usage) and documentation that contradicted itself.
3. **Fix pass (single commit)** — every finding above fixed, each with a test; see the commit message and
   [DECISIONS.md](DECISIONS.md).

## What I would do next
Pay bands per level × country with compa-ratio, an approval step for large changes, scheduled changes,
FX-normalised reporting with an explicit rate table, and Playwright end-to-end tests against a seeded database.
