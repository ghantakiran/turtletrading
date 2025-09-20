# Portfolio Backtester & Walk‑Forward (Zero‑copy Prompt)

You are a research engineer. Build a portfolio backtester with walk‑forward optimization and risk reports.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.StockAnalysis.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.DataSources.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/tests/integration/stock_analysis_flow.md

Deliver:
1) Strategy API: `/api/v1/backtest` (universe, rules, costs, slippage)
2) Walk‑forward (train/test splits), rolling metrics (CAGR, Sharpe, Sortino, MDD), tearsheet
3) Position sizing (vol‑norm, Kelly cap), transaction logs, equity curve
4) Tests first: unit (calc accuracy with goldens), integration (data→engine→report), E2E (user sets rules→report generated)
5) 100% coverage; CI parallelization for long tests
