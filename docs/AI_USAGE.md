# How AI tools were used

The assessment asks for intentional AI use. This file records what was delegated, how output was checked,
and where AI output was rejected or corrected.

## v1 build
> **TODO (author):** add the main prompts/instructions you used to build v1, which tool, and what you
> changed by hand. Reviewers want to see your judgement, not just the output.

## Review and fix pass (Claude Code)
**Prompts (paraphrased):**
1. "Review the code in this repo against the assignment brief and list findings."
2. "Fix all of the findings, in one commit with an explanation."

**How the output was verified rather than trusted:**
- Each bug fix comes with a test that fails on the old code. Example: the new CSV test was run against
  the original controller and received the body `{}`, confirming the bug before the fix.
- Raw SQL (analytics percentiles, row lock) is covered by integration tests against real PostgreSQL in CI,
  because mocked Prisma tests cannot catch SQL mistakes.
- Lint, typecheck, unit/HTTP/component tests and both production builds were run locally before committing.

**Corrections made during the pass (AI mistakes caught by tests/tooling):**
- Test helper ordering: building a supertest request before awaiting a login request closed the shared
  server; the tests failed and were restructured.
- A nested `<label>` made the large-change confirmation checkbox inaccessible; a UI test caught it and the
  markup was fixed (not the test).
- Iterating a `Map` with spread failed the ES5 TypeScript target; replaced with `Array.from`.

**Decisions kept with the human:** scope cuts in [REQUIREMENTS.md](REQUIREMENTS.md) (no FX conversion,
no scheduled changes, currency fixed per employee) and the 20% confirmation threshold.
