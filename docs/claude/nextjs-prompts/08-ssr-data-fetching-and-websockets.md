# 08 — SSR Data Fetching & WebSockets (Zero‑copy Prompt)

You are a Next.js engineer. Standardize SSR/ISR data and WS client hooks.

Context:
@/Users/kiranreddyghanta/TurtleTrading/TODO.md

Deliver:
1) Data layer: fetch wrappers with caching/timeout/retry; ISR where applicable
2) WS hooks with reconnection, backoff, subscription mgmt; Zustand integration
3) Error boundaries at route/segment/component levels
4) Tests first: unit (fetch/WS utils), integration (route data), E2E (streaming flows)
5) 100% coverage; perf/a11y budgets
