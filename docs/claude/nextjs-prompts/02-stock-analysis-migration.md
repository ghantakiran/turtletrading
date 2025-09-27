# 02 — Stock Analysis Migration (Zero‑copy Prompt)

You are a Next.js engineer. Migrate the complex StockAnalysis page to App Router with SSR data, streaming charts, and client components.

Context:
@/Users/kiranreddyghanta/TurtleTrading/TODO.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/PRD_UI.md

Deliver:
1) Route structure: `app/(protected)/analysis/[symbol]/page.tsx`
2) Server components: data loaders (price, indicators, sentiment, LSTM)
3) Client components: charts, tools, timeframes, predictions, sentiment widgets
4) WS hooks with Zustand integration; error boundaries
5) Tests first: unit (components/hooks), integration (route data), E2E (navigate→analyze)
6) 100% coverage; perf/a11y budgets; streaming data hydration
