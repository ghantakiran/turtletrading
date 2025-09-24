# Product Requirements Document (PRD) — TurtleTrading UI & Alerting Platform

## 1. Summary
Build a professional, real‑time trading analytics UI with dashboards, stock analysis, alerts, market views, portfolio, and personalization. Emphasize dark‑first design, accessibility, speed to insight, and explainable AI. Integrate with existing backend (FastAPI), WebSockets, and sentiment services.

## 2. Goals & Non‑Goals
- Goals:
  - Real‑time dashboard with portfolio, market, watchlist, alerts
  - Stock analysis views with charts, technicals, LSTM predictions, sentiment
  - Alert creation/management with testing and performance tracking
  - Personalization: layouts, themes, indicators, thresholds
  - Mobile‑first responsive UX; a11y compliant
- Non‑Goals:
  - Brokerage execution (covered in separate PRD)
  - Research/quant IDE (separate track)

## 3. Users & Modes
- Beginner: simplified surfaces, coachmarks, safe defaults
- Intermediate: standard features, editable indicators
- Advanced/Pro: all tools, advanced alerts, dense data views

## 4. Information Architecture
- Sidebar Navigation: Dashboard, Portfolio, Watchlist, Analytics, Alerts, Market, News & Sentiment, Settings
- Header: market status, global search (autocomplete), notifications, quick actions, profile
- Mobile: bottom nav (Dashboard, Watchlist, Alerts, Portfolio), gesture support

## 5. Key Use Cases & Flows
1) Monitor market & portfolio → notice alert → drill into stock → review LSTM/technicals/sentiment → update thresholds
2) Build watchlist → scan for breakouts → set technical + sentiment alert combo → receive notification → log outcome
3) Analyze symbol → view prediction bands & historical accuracy → compare indicators → save preset → share snapshot
4) Configure dashboard layout → reorder widgets → save per‑device layouts → export/share

## 6. Feature Requirements
### 6.1 Dashboard
- Portfolio overview: value, P&L, allocation chart, top movers, rebalance quick actions
- Market summary: index mini‑charts, sector heatmap, breadth, fear/greed
- Alerts panel: categorized, priority chips, history, performance KPI
- Customization: drag‑drop widgets, resize, per‑user layouts

### 6.2 Watchlist
- Real‑time rows: price, % change, volume, sentiment, breakout signal
- Multi‑select actions: alert, tag, export
- Columns: configurable; keyboard shortcuts; CSV export

### 6.3 Stock Analysis
- Charts: candlestick/line, overlay indicators (RSI, MACD, Bollinger), volume bars, drawing tools
- LSTM: prediction bands (1‑30d), confidence, historical accuracy, model notes
- Sentiment: overall score, trends, source breakdown (news/social), timelines
- Timeframes: 1D/1W/1M/3M/6M/1Y/All; multi‑timeframe compare

### 6.4 Alerts
- Wizard: price/technical/sentiment conditions, multi‑condition builder
- Preview/test: simulate triggers on historical data
- Delivery: in‑app, email, webhook; retry/backoff; mute/snooze
- Tracking: alert performance KPIs (precision, recall, win rate)

### 6.5 Market
- Indices cards: SPY/QQQ/DIA/IWM with trends
- Sector performance heatmap; breadth (A/D ratio); volatility index

### 6.6 News & Sentiment
- Aggregated feed; dedupe; entity mapping; filters
- Sentiment indicators; source mix; drilldowns to original links

### 6.7 Settings & Personalization
- Themes (dark‑first), color palettes, font scaling, contrast mode
- Indicators presets; alert thresholds; keyboard mapping
- Data refresh & streaming preferences

## 7. Design System
- Dark palette: bg #1a1a1a/#0f172a, surfaces #2d2d2d/#1e293b, primary #10b981, danger #ef4444, info #3b82f6
- Components: cards, tables, charts, tabs, chips, modals, tooltips, toasts, skeletons
- Accessibility: AA contrast, focus outlines, keyboard trapping, aria labels, motion prefs

## 8. Data & Integrations
- Realtime: WebSocket streams (quotes, alerts, sentiment)
- REST: FastAPI endpoints for stocks/market/sentiment/alerts
- Caching: client state via React Query; streaming hydration

## 9. Performance & Telemetry
- Budgets: TTI < 2s (3G), WS latency < 100ms, chart FPS 60, updates < 50ms
- Instrumentation: web‑vitals, custom spans, user timings; error boundaries
- Lazy‑loading, route code‑splitting, virtualization, snapshot caching

## 10. Security & Compliance
- Auth: JWT; secure storage; CSRF/CORS guards
- PII handling: telemetry redaction; consent for data capture
- Audit: UI actions log (alert create/update, layout changes)

## 11. Acceptance Criteria
- Flows: dashboard, watchlist, stock analysis, alerts, market, sentiment, settings implemented per specs
- A11y: keyboard nav, screen readers, high‑contrast, text scaling verified
- Mobile: bottom nav, gestures, offline cache, push opt‑in
- Performance: budgets enforced; CI fails on regressions
- Tests: 100% unit/branch/function coverage; Playwright E2E for golden/failure/retry/idempotency/a11y

## 12. Milestones
- M1 (Foundations): design system, layouts, charts, websockets, basic alerts
- M2 (Insights): LSTM visualization, sentiment dashboards, watchlist power tools
- M3 (Personalization): layouts, presets, advanced alerts, export/share
- M4 (Polish): performance budgets, a11y audits, mobile PWA

## 13. Open Questions
- Which charting lib final? (Recharts vs Highcharts vs lightweight‑charts)
- Push notifications provider? (Web Push vs 3rd‑party)
- Data retention for UI audit logs?

## 14. References
- External links in original brief; internal modules in `docs/claude/modules/*`
