# Options Analytics & Greeks (Zero‑copy Prompt)

You are a quant engineer. Add options analytics (Black‑Scholes, binomial, IV, Greeks) with APIs and UI.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/Claude.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.StockAnalysis.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.UserInterface.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/specs/stock-analysis/technical_analysis_tests.md

Deliver:
1) API: `/api/v1/options/{symbol}` with params (expiry, strike, type) → price/IV/Greeks JSON
2) Pricing engines: BS (closed form), CRR binomial, IV via Brent/bisection; dividends, rates
3) UI: options chain table, IV surface chart, Greeks panel; keyboard‑first; a11y
4) Tests first: unit (pricing accuracy vs golden files), integration (API contracts), E2E (flow: select symbol→expiry→strike)
5) 100% coverage; CI jobs updated
