# Market Microstructure Simulator (Zero‑copy Prompt)

You are a simulation engineer. Build a limit order book (LOB) simulator for strategy testing.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.MarketData.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.StockAnalysis.md

Deliver:
1) LOB engine: orders, queues, partial fills, latency model; CSV playback
2) API: `/api/v1/simulate` (scenario, latency, tick size, spreads)
3) Outputs: slippage, market impact, queue priority stats, trade logs
4) Tests first: unit (matching), integration (API+engine), E2E (configure→run→analyze)
5) 100% coverage; perf budget; reproducible seeds
