# Data Vendors Orchestration (Zero‑copy Prompt)

You are a data platform engineer. Orchestrate multiple vendors with SLAs and failover.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.DataSources.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/config/coverage.md

Deliver:
1) Vendor registry with scoring (latency, freshness, error rate, cost)
2) Router with circuit breakers, hedged requests, canarying
3) Billing/usage tracking, keys vaulting, quota management
4) Tests first: unit (routing decisions), integration (failover), E2E (degradation→fallback)
5) 100% coverage; reports and alerts on SLA breaches
