# Brokerage API Integration (Paper/Live) (Zero‑copy Prompt)

You are an integrations engineer. Add a brokerage abstraction with paper/live trading.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.API.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.Infrastructure.md

Deliver:
1) Abstraction: `BrokerAdapter` interface (place/cancel/modify orders, positions, balances)
2) Adapters: Paper (sim fill rules), Alpaca/IB (mock keys), sandbox config
3) Webhook ingestion for fills; order state machine; idempotency keys
4) Tests first: unit (state transitions), integration (adapter contracts), E2E (paper trade from UI)
5) 100% coverage; secrets via env; CI with sandbox
