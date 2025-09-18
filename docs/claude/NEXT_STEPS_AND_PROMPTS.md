# TurtleTrading • Next Steps and Zero-Copy Prompts

This guide gives you ready-to-run prompts that reference files directly from your workspace, so there’s no copy/paste. Use them in Claude/Cursor where file inclusion by absolute path is supported.

## Next steps
- Validate split docs: `docs/claude/Claude.md`, modules in `docs/claude/modules/`, specs in `docs/claude/tests/**`.
- Implement from docs using the multipart prompts in `docs/claude/prompts/` with the Coordinator Prompt below.
- Run continuous tests locally while implementing:
  - Backend: `pytest -q --cov=backend/app --cov-branch --cov-report=term-missing --cov-report=xml --cov-fail-under=100`
  - Frontend: `npm run test:coverage --workdir=frontend`
  - E2E (Playwright): `npm run test:e2e --workdir=tests`
- Wire CI with 100% gates (`.github/workflows/test-coverage.yml`).
- Iterate until unit, integration, and E2E coverage are all 100%.

## Coordinator Prompt (Zero‑copy, reads parts from repo)
Paste the block below into Claude. It will pull all parts from your workspace by path.

```markdown
You are a principal engineer. Read the following prompt parts from my repo in order and then implement everything as specified. Do not regenerate earlier parts; continue where the previous part ends. Produce complete, runnable code with 100% unit/branch/integration coverage and Playwright E2E.

Read these files in order (absolute paths):
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/prompts/part_aa
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/prompts/part_ab
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/prompts/part_ac
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/prompts/part_ad
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/prompts/part_ae
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/prompts/part_af
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/prompts/part_ag

Rules:
- Preserve memory across parts; treat them as a single continuous prompt.
- Follow the implementation instructions contained within the parts (file plan → full file contents → final checklist).
- Enforce TDD: implement tests first as per specs, then code. Achieve 100% coverage (branch/line/function) for backend, frontend, and integration.
- Generate CI with 100% gates and artifacts (HTML/LCOV/JUnit) and services (postgres, redis).
- Include Playwright E2E (golden, failure, timeout/retry, idempotency, accessibility).
- Respect repo structure, Makefile, and env patterns.

Output format (strict):
1) File plan (all files added/updated, one‑line purpose each)
2) Full file contents for each path (no placeholders). Batch outputs logically (backend → frontend → tests → CI) to stay within limits.
3) Final checklist with pass/fail against the requirements.
```

## Continuous Testing Prompt (keeps tests running while you implement)
Use this prompt to have the model plan and execute a tight red‑green‑refactor loop with coverage gates.

```markdown
Act as a TDD facilitator. While you implement the files from the Coordinator Prompt output, ensure continuous test runs and coverage enforcement:

- Backend: run `pytest -q --cov=backend/app --cov-branch --cov-report=term-missing --cov-report=xml --cov-fail-under=100`
- Frontend: run `npm run test:coverage` in `frontend/`
- E2E: run `npm run test:e2e` in `tests/`
- If coverage < 100% or any tests fail, stop and write the missing tests or code edits necessary; then re‑run.
- Use deterministic seeds, fake time, and stable snapshots per the docs.
- Keep iterating until all suites pass at 100% and the CI workflow also passes locally.

When you need context, read from:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/Claude.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.Authentication.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.DataSources.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.Infrastructure.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.MarketData.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.StockAnalysis.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.Testing.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.UserInterface.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/config/coverage.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/integration/real_time_data_flow.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/integration/stock_analysis_flow.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/specs/authentication/jwt_security_tests.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/specs/market-data/real_time_streaming_tests.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/specs/stock-analysis/lstm_prediction_tests.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/specs/stock-analysis/technical_analysis_tests.md
```

## CI Gate Prompt (final verification)
Use after the implementation to make sure CI is fully wired with 100% thresholds.

```markdown
Validate the CI and coverage gates:
- Inspect `.github/workflows/test-coverage.yml` and confirm:
  - Services: postgres:14, redis:7 with health checks
  - Jobs: backend coverage (pytest‑cov 100%), frontend coverage (Vitest 100%), e2e coverage
  - Artifacts uploaded (HTML/LCOV/JUnit)
  - Merge coverage step that enforces combined 100%
- Check scripts in `scripts/` (coverage merge/enforce/badge) and ensure paths match outputs.
- If any mismatch, output fixed file edits and re-validated workflow content.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/config/coverage.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/IMPLEMENT_FROM_DOCS_FILLED.md
```

## Notes
- The multipart prompts are already prepared in `docs/claude/prompts/*` with headers/footers.
- These prompts rely on your environment’s ability to include files via absolute path with the `@/abs/path` syntax.
- Keep outputs batched by directory to avoid token limits (e.g., backend → frontend → tests → CI).
