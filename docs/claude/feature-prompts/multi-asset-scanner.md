# Multi‑Asset Breakout/Scanner (Zero‑copy Prompt)

You are a systems engineer. Add a Donchian/ATR multi‑asset scanner for stocks/FX/crypto.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.MarketData.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.DataSources.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/integration/real_time_data_flow.md

Deliver:
1) Scanner API: `/api/v1/scanner/run` (universe, lookbacks, ATR sizing)
2) Async fanout with rate‑limit guards; Redis queuing; sector bucketing
3) UI: watchlist column + sort; alerts; CSV export; keyboard nav
4) Tests first: unit (signals), integration (fanout/correlations), E2E (scan→sort→alert)
5) 100% coverage; perf budget for scan runtime
