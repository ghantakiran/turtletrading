You are a principal engineer. Implement the TurtleTrading system exactly as specified in the split docs. Produce complete, runnable code and configurations with 100% unit, branch, and integration coverage, plus Playwright E2E. Do not return analysis—return the file plan and full file contents only.

STACK = python-fastapi-sqlalchemy-pytest-coverage + react18-typescript-jest-rtl + playwright + postgres + redis
REPO CONVENTIONS (must honor):
- Backend: FastAPI (async), SQLAlchemy, Alembic, Pydantic, JWT, Redis cache & rate-limit, LSTM boundary (TensorFlow later), yfinance primary + Alpha Vantage fallback (completed).
- Frontend: React 18 + TypeScript, Tailwind, React Query, React Router, RTL, Socket.io, Recharts.
- Infra: Docker/Compose, Nginx, Makefile targets (make dev/test/test-e2e/etc.).
- Tests: Backend PyTest; Frontend Jest+RTL; E2E Playwright in root `tests/`.
- DB: Postgres; Redis. Deterministic seeds for CI/local.
- Docs: Integration home `docs/claude/Claude.md`; modules under `docs/claude/modules/`.

INPUT (paste the results of the split here)
<<<DOCS_INPUT_START>>>
[PASTE the file plan and the contents of all generated docs:
- docs/claude/Claude.md
- docs/claude/modules/** (all modules)
- docs/claude/tests/** (unit + integration specs + coverage config)
- docs/ui/PerplexityFinancePlus.md
- docs/db/schema.md
- Any tasks.md / planning.md / todo.md if they contain REQ-IDs referenced by specs]
<<<DOCS_INPUT_END>>>

OBJECTIVE
- Implement code, tests, CI, DB schema/migrations/seeds, and UI skeleton strictly per the above docs. Every public function/endpoint/state transition must have positive/negative/edge tests. Contracts must have integration tests. E2E must cover golden/failure/retry/timeout/idempotency/a11y. Achieve 100% coverage gates locally and in CI.

OUTPUT FORMAT (STRICT)
1) File plan: bullet list of every file you create/update with one-line purpose.
2) Full file contents for each path in fenced code blocks. No placeholders, no “…”; everything must be runnable.
3) Final checklist with pass/fail for:
   - All specs implemented
   - 100% unit/branch/integration coverage
   - E2E scenarios implemented (with traces/videos)
   - DB migrations + seeds wired in CI
   - Makefile scripts preserved and working

IMPLEMENTATION TARGETS (exact paths)
- backend/app/** (FastAPI routers, services, models, deps, auth, caching, rate-limit, AV fallback adapter)
- backend/app/alembic/** (migrations) and/or database/migrations/0001_initial.sql
- backend/tests/unit/** and backend/tests/integration/**
- frontend/src/** (components, pages, services, hooks, contexts, types)
- frontend/tests/unit/** and frontend/tests/integration/**
- tests/e2e/** (Playwright specs, fixtures)
- database/schema.sql, database/seed/dev.sql
- docs/claude/tests/config/coverage.md (implemented as tooling/config files below)
- .github/workflows/ci.yml (coverage gates 100%; services: postgres, redis)
- jest.config.(ts|js), tsconfig.json, playwright.config.(ts|js)
- pyproject.toml or requirements.txt + pytest.ini + coverage config (branch=true, fail-under=100)
- .env.example (safe defaults; no secrets)
- README.md (how to run app/tests/coverage; links to docs)

TEST & COVERAGE REQUIREMENTS (NON-NEGOTIABLE)
- PyTest command must pass with 100%: 
  pytest -q --cov=backend/app --cov-branch --cov-report=term-missing --cov-report=xml --cov-fail-under=100
- Jest command must pass with 100% thresholds (branches/statements/functions/lines) and produce lcov + html.
- Playwright runs against local app, with retries, traces, video-on-failure, and accessibility scan. Include scripts to start/stop app for CI.
- Contract tests: UI↔API, API↔DB/Redis, yfinance↔AlphaVantage adapter seam.
- Deterministic seeds, fake timers/clocks, controlled randomness. No flaky tests.

CI/CD (GITHUB ACTIONS)
- Matrix: Python 3.11+, Node 18+ (Linux). Cache deps.
- Services: postgres:14, redis:7 with health checks.
- Steps: checkout → setup/caches → install → lint/typecheck → backend unit (100%) → backend integration (100%) → frontend unit/integration (100%) → spin app → Playwright e2e → upload coverage artifacts (HTML/LCOV/JUnit). Fail build on <100%.

UI: PERPLEXITY FINANCE PLUS
- Implement a robust skeleton that fulfills docs/ui/PerplexityFinancePlus.md: global search+compare, narratives with rationale transparency, audit trails, hypothesis testing, keyboard-first, a11y (WCAG AA), perf budgets. Provide components, routes, loading/error/empty states, i18n hooks.

CONSTRAINTS
- Match repo structure and Makefile commands; don’t break existing workflows.
- Use environment variables via .env.example; never commit secrets.
- Keep error handling, logging, and rate limiting consistent with docs.
- Use relative links in docs; no duplication.

DELIVERABLES
- Complete file plan and full file contents for ALL changes above.
- All tests and coverage configs included and passing under the documented commands.
- CI workflow that enforces the gates and uploads artifacts.
