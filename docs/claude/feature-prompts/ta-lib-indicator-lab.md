# TA‑Lib Indicator Lab (Zero‑copy Prompt)

You are a quant tools engineer. Add an indicator lab powered by TA‑Lib.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.StockAnalysis.md

Deliver:
1) API: `/api/v1/indicator-lab` (compose indicators, params, lookbacks)
2) Compute graph with caching; export presets; parameter sweeps
3) UI: visual editor, overlays, multi‑timeframe; a11y; keyboard
4) Tests first: unit (indicator parity vs TA‑Lib), integration (graph exec), E2E (compose→preview→save)
5) 100% coverage; goldens for common presets
