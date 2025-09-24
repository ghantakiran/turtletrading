# CI Coverage & E2E (Zero‑copy Prompt)

You are a QA lead. Ensure CI enforces 100% coverage and E2E across UI flows.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/PRD_UI.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/config/coverage.md

Deliver:
1) Configure jobs for frontend unit (Vitest), integration, Playwright E2E (golden/failure/retry/idempotency/a11y)
2) Artifacts: HTML/LCOV/JUnit uploads; traces/videos on fail
3) Gates: fail if coverage < 100% (branches/lines/functions), fail on perf regressions
4) Tests first: add missing specs; fix scripts; update workflow yaml
5) 100% coverage; green CI run locally and in GitHub Actions
