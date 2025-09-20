# Payments & Plan Gating (RBAC, Quotas) (Zero‑copy Prompt)

You are a platform PM/engineer. Add payments, entitlements, and quotas.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.Authentication.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/Claude.md

Deliver:
1) Plans: free/pro/enterprise features; API quotas; WebSocket limits; priority
2) Payments: Stripe integration (webhooks, portal), receipts, tax IDs (sandbox)
3) Enforcement: middleware for RBAC/quotas; usage metering; dashboards
4) Tests first: unit (entitlement logic), integration (Stripe webhooks), E2E (upgrade→unlock)
5) 100% coverage; secrets via env; CI with Stripe CLI mock
