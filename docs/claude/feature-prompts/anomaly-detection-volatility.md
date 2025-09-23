# Anomaly Detection & Volatility Regimes (Zero‑copy Prompt)

You are a quant ML engineer. Add anomaly detection and regime classification.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.StockAnalysis.md

Deliver:
1) Models: z‑score spikes, EWMA, GARCH, isolation forest; labels for regimes
2) API: `/api/v1/regimes` (symbol, window) → regime timeline + confidence
3) UI: overlays on charts; alerts; a11y
4) Tests first: unit (metrics vs goldens), integration (pipeline), E2E (identify regime shift)
5) 100% coverage; deterministic seeds
