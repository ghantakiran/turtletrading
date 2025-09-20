# Risk Engine (VaR/CVaR/Position Limits) (Zero‑copy Prompt)

You are a risk engineer. Add a cross‑asset risk engine.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.StockAnalysis.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.Infrastructure.md

Deliver:
1) Risk API: `/api/v1/risk` → VaR/CVaR (historical/Monte‑Carlo), exposures, limits
2) Limits: per‑asset, sector, correlation buckets, margin; breach alerts
3) Backtest overlays: drawdowns, heatmaps, stress scenarios
4) Tests first: unit (risk calc accuracy vs goldens), integration (limits enforcement), E2E (breach→alert)
5) 100% coverage; CI perf floor for sims
