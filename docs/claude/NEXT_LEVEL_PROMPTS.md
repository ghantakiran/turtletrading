# Next‑Level Improvement Prompts (Zero‑copy, repo‑aware)

These prompts upgrade security, performance, SRE, ML quality, developer experience, and UX—while preserving 100% TDD coverage and Playwright E2E.

## 1) Security Hardening & Threat Modeling
```markdown
You are an application security architect. Review and harden security across backend, frontend, infra, and CI:

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/Claude.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.Authentication.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.Infrastructure.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/specs/authentication/jwt_security_tests.md
@/Users/kiranreddyghanta/TurtleTrading/.github/workflows/test-coverage.yml

Deliver:
1) STRIDE threat model (diagrams + tables)
2) Concrete fixes: secrets, JWT rotation, CSRF/CORS, rate‑limit abuse, SSRF/egress, dependency pinning/SBOM
3) Edits: code/config changes with tests first
4) New tests: unit/contract/e2e for vulns; keep 100% coverage
5) CI additions: SAST/DAST (e.g., Semgrep, Trivy), supply‑chain (Sigstore), policy gates
```

## 2) Performance & Cost Optimization (SLO/SLA)
```markdown
You are a performance engineer. Enforce SLOs, reduce latency/costs, and add budgets.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/Claude.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.MarketData.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.Infrastructure.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/integration/real_time_data_flow.md

Deliver:
1) Perf budgets (API p95 < 500ms, WS < 100ms, FE TTI < 2s)
2) Flamegraph plan, caching strategy, read vs write paths, N+1 checks
3) Edits: indexes, query plans, Redis key strategy, batching, backpressure
4) Synthetic perf tests and Playwright trace checks
5) CI perf gate: fail if budgets exceeded; keep tests 100% covered
```

## 3) Reliability, SRE & Chaos Engineering
```markdown
You are an SRE. Add failure resilience and operational excellence.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.Infrastructure.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/integration/stock_analysis_flow.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/config/coverage.md

Deliver:
1) Runbooks: paging, on‑call rotation, SLIs/SLOs, error budgets
2) Chaos tests: API outage, cache eviction storm, DB failover, latency injection
3) Health/readiness probes, circuit breakers, retries with jitter, idempotency
4) Observability: OpenTelemetry spans/metrics/logs with dashboards
5) CI job to run chaos suite nightly; tests remain 100%
```

## 4) ML Quality, Drift Monitoring, and Reproducibility
```markdown
You are an ML platform engineer. Improve LSTM reliability and monitoring.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.StockAnalysis.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/specs/stock-analysis/lstm_prediction_tests.md

Deliver:
1) Data versioning and feature store plan; deterministic seeds; reproducible pipelines
2) Drift detection (data & concept), canary model rollout, shadow testing
3) Offline/online eval metrics; threshold alerts; model registry
4) Edits: training/inference seams; dependency isolation; CPU/GPU profiles
5) New tests for drift, rollback, and threshold violations; keep 100%
```

## 5) Developer Experience (DX) & Monorepo Tooling
```markdown
You are a DX lead. Streamline local dev and CI speed.

Context:
@/Users/kiranreddyghanta/TurtleTrading/README.md
@/Users/kiranreddyghanta/TurtleTrading/Makefile
@/Users/kiranreddyghanta/TurtleTrading/.github/workflows/test-coverage.yml

Deliver:
1) Taskgraph + caching (e.g., Turborepo/Make upgrades) for incremental tests
2) Precommit: lint/type/format hooks; template generators; error oracles
3) Devcontainers/Dockerfile.dev for one‑command onboarding
4) Test data factories; golden files management; snapshot review flows
5) CI parallelization and artifact reuse; all tests 100%
```

## 6) UI/UX: Perplexity Finance Plus v2
```markdown
You are a product design lead and frontend architect. Evolve the PF+ spec for clarity and speed to insight.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.UserInterface.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/specs/market-data/real_time_streaming_tests.md

Deliver:
1) New flows: compare portfolios, what‑if simulator, explainable insights, audit trails
2) Accessibility upgrades to WCAG AA+; keyboard‑first; screenreader maps
3) Performance budgets, code‑splitting routes, skeletons, streaming data hydration
4) Playwright scenarios for new flows w/ a11y checks
5) Component library tokens/themes with dark‑mode contrast checks
```

## 7) Data Integrity, Compliance & Auditability
```markdown
You are a compliance engineer. Add auditability and data governance.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/Claude.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.DataSources.md

Deliver:
1) Immutable audit logs, tamper‑evident hashing, retention policy
2) PII catalog, access controls, DSR workflows (GDPR/CCPA)
3) Data lineage: contracts and schema registry; migration playbooks
4) Tests: audit trail assertions, redaction, access checks; 100% coverage
5) CI compliance gate with reports
```

## Acceptance Criteria (applies to all prompts)
- Test‑first edits; keep unit/branch/function coverage at 100% across back/front/integration.
- Playwright E2E extended with golden path, failures, timeout/retry, idempotency, a11y.
- CI updates provided (jobs/steps/services/artifacts) and runnable locally.
- Clear runbooks and rollbacks; no secrets in repo; reproducible commands.

## Coordinator Prompt (run after choosing a section)
```markdown
You are the lead for the chosen improvement area. Read the referenced files above and produce:
1) File plan and rationale
2) Test specs first (unit/contract/e2e) to close gaps
3) Complete file edits (code/config/docs) to implement
4) Updated CI jobs for new checks
5) Final checklist proving 100% coverage and passing CI
Return only the file plan, edited files, and checklist.
```
