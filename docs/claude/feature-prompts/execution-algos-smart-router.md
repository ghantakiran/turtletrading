# Execution Algos & Smart Order Router (Zero‑copy Prompt)

You are an execution engineer. Implement TWAP/VWAP/POV and a smart router.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.MarketData.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.Infrastructure.md

Deliver:
1) Algo API: `/api/v1/exec` (algo, schedule, participation), venue adapter
2) Router: venue stats, fees, queue depth; best‑ex policies; safety limits
3) Simulator hooks with LOB for backtesting algos
4) Tests first: unit (schedule), integration (router decisions), E2E (place algo→monitor→complete)
5) 100% coverage; guardrails for fat‑finger
