# Alerting, Webhooks & Notification Center (Zero‑copy Prompt)

You are a platform engineer. Add multi‑channel alerts and webhooks.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.MarketData.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/integration/real_time_data_flow.md

Deliver:
1) Rules API: `/api/v1/alerts` CRUD; channels (email, Slack, webhook); templates
2) Delivery: retry with backoff/jitter; dedupe; idempotency keys; audit log
3) UI: notification center; rule builder; per‑rule mute/snooze; a11y
4) Tests first: unit (rules eval), integration (delivery, retries), E2E (create→trigger→ack)
5) 100% coverage; rate‑limit and anti‑spam controls
