# Claude.UserInterface

- **Purpose**: Provide responsive, accessible frontend interface with state management, routing, and real-time updates for trading platform users
- **Scope (in/out)**:
  - **In**: React components, routing, state management (Zustand + React Query), responsive design, error boundaries, form validation, WebSocket integration
  - **Out**: Backend API logic (handled by other modules), data persistence (handled by Infrastructure), business calculations (handled by StockAnalysis/MarketData)
- **Public API (signatures, inputs/outputs, errors)**:
  - Routes: `/`, `/stock/:symbol`, `/market`, `/settings`, `/about`
  - Components: `<Layout />`, `<Dashboard />`, `<StockAnalysis />`, `<LoginForm />`, `<ErrorBoundary />`
  - Hooks: `useStockData(symbol)`, `useMarketData()`, `useAuth()`, `useWebSocket()`
  - State: `useAuthStore()`, `useMarketStore()`, `useUIStore()`
- **Data contracts (schemas, invariants)**:
  - AuthState: isAuthenticated(boolean), user(UserProfile|null), loading(boolean), error(string|null)
  - MarketState: stockPrices(Map<string, StockPrice>), watchlists(Array), isConnected(boolean), lastUpdate(timestamp)
  - UIState: theme("light"|"dark"|"system"), sidebarOpen(boolean), notifications(Array), screenSize(string)
  - RouteParams: symbol(valid_stock_symbol), period(valid_timeframe), filters(object)
- **Dependencies (internal/external)**:
  - **Internal**: Authentication (JWT tokens), StockAnalysis (price/technical data), MarketData (real-time updates), Infrastructure (WebSocket)
  - **External**: React 18, TypeScript, Vite, TailwindCSS, React Router, Zustand, React Query, Socket.io-client
- **State & concurrency model**: Hybrid state management with Zustand for client state, React Query for server state, optimistic updates with rollback on error
- **Failure modes & retries**: Network errors → retry with exponential backoff; component errors → error boundary isolation; WebSocket disconnect → auto-reconnection
- **Performance/SLOs**: <2s initial load, <100ms state updates, <50ms component renders, <500ms route transitions, 60fps animations
- **Security/permissions**: XSS protection via React, CSRF protection via tokens, input sanitization, secure token storage, no sensitive data in localStorage
- **Observability (logs/metrics/traces)**: User interaction tracking, performance metrics, error tracking, route timing, component render counts
- **Change risks & migration notes**: State schema changes need migration functions; React version updates require dependency testing; design system changes affect all components

## TDD: Requirements → Tests

### REQ-UI-01: Responsive layout with mobile-first design and accessibility
- **Unit tests**:
  - UT-UI-01.1: Given mobile viewport (320px) When render Layout Then show hamburger menu and collapse sidebar
  - UT-UI-01.2: Given desktop viewport (1024px) When render Layout Then show full navigation and expanded sidebar
  - UT-UI-01.3: Given keyboard navigation When tab through components Then focus follows logical order with visible indicators
- **Edge/negative/property tests**:
  - ET-UI-01.1: Given extremely narrow viewport (100px) When render Then maintain minimum usable layout
  - ET-UI-01.2: Given screen reader enabled When navigate interface Then announce all interactive elements
  - PT-UI-01.1: Property: all interactive elements have aria-labels, color contrast ≥ 4.5:1, touch targets ≥ 44px
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock window.matchMedia for viewport testing
  - Stub ResizeObserver with controllable viewport changes
  - Fake touch events for mobile interaction testing
- **Coverage mapping**:
  - Lines/branches/functions covered: Layout component, responsive hooks, accessibility helpers, breakpoint utilities

### REQ-UI-02: State management with Zustand and React Query integration
- **Unit tests**:
  - UT-UI-02.1: Given user login action When updateAuthState() Then persist authentication and sync across components
  - UT-UI-02.2: Given stock price update When useStockData() Then update cache and trigger re-render
  - UT-UI-02.3: Given network error When API call fails Then show error state and enable retry
- **Edge/negative/property tests**:
  - ET-UI-02.1: Given localStorage unavailable When persist state Then gracefully degrade without errors
  - ET-UI-02.2: Given stale cache data When network available Then background refresh and update
  - PT-UI-02.1: Property: state updates are atomic, no intermediate invalid states, cache coherence maintained
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock Zustand store with controllable state scenarios
  - Stub React Query with deterministic cache behavior
  - Fake localStorage with quota exceeded simulation
- **Coverage mapping**:
  - Lines/branches/functions covered: useAuthStore, useMarketStore, useUIStore, React Query hooks, cache invalidation

### REQ-UI-03: Real-time WebSocket integration with connection management
- **Unit tests**:
  - UT-UI-03.1: Given WebSocket connection When price update received Then update UI without full re-render
  - UT-UI-03.2: Given connection lost When useWebSocket() Then show disconnected state and attempt reconnection
  - UT-UI-03.3: Given subscription to symbol When user navigates away Then unsubscribe to prevent memory leaks
- **Edge/negative/property tests**:
  - ET-UI-03.1: Given malformed WebSocket message When received Then ignore and maintain connection
  - ET-UI-03.2: Given rapid connection/disconnection When network unstable Then debounce reconnection attempts
  - PT-UI-03.1: Property: subscriptions cleaned up on unmount, no duplicate subscriptions, message order preserved
- **Test doubles (mocks/stubs/fakes) and seams**:
  - Mock WebSocket with controllable connect/disconnect scenarios
  - Stub message queue with deterministic delivery
  - Fake network conditions for connection testing
- **Coverage mapping**:
  - Lines/branches/functions covered: useWebSocket hook, connection manager, subscription cleanup, message handlers

### Traceability Matrix: REQ-IDs ↔ Tests
| REQ-ID | Unit Tests | Edge Tests | Property Tests | Integration Tests |
|--------|------------|------------|----------------|-------------------|
| REQ-UI-01 | UT-UI-01.1-3 | ET-UI-01.1-2 | PT-UI-01.1 | IT-UI-01 |
| REQ-UI-02 | UT-UI-02.1-3 | ET-UI-02.1-2 | PT-UI-02.1 | IT-UI-02 |
| REQ-UI-03 | UT-UI-03.1-3 | ET-UI-03.1-2 | PT-UI-03.1 | IT-UI-03 |

## Implementation Guidance (after specs)

### Algorithms/Flow
1. **Component Lifecycle**: mount → load_initial_state() → subscribe_to_updates() → handle_user_interactions() → cleanup_on_unmount()
2. **State Synchronization**: user_action() → optimistic_update() → api_call() → success ? confirm : rollback()
3. **Route Navigation**: route_change() → load_route_data() → update_breadcrumbs() → render_page_component()

### Pseudocode (reference)
```typescript
const useStockData = (symbol: string) => {
  const { data, error, isLoading } = useQuery(
    ['stock', symbol],
    () => fetchStockPrice(symbol),
    {
      staleTime: 60000, // 1 minute
      refetchInterval: 30000, // 30 seconds
      onError: (error) => useUIStore.getState().showNotification({
        type: 'error',
        message: `Failed to load ${symbol} data`
      })
    }
  );

  // Subscribe to WebSocket updates
  useEffect(() => {
    const unsubscribe = websocketManager.subscribe(symbol, (update) => {
      queryClient.setQueryData(['stock', symbol], update);
    });

    return unsubscribe;
  }, [symbol]);

  return { data, error, isLoading };
};
```

### Error Handling & Retries
- **Component errors**: Error boundaries isolate failures, show fallback UI, enable retry
- **Network errors**: Exponential backoff (1s, 2s, 4s), max 3 retries, user notification
- **State corruption**: Reset to last known good state, re-fetch critical data
- **WebSocket errors**: Auto-reconnect with increasing delays, fallback to polling

### Config/flags
```typescript
UI_CONFIG = {
  "WEBSOCKET_RECONNECT_INTERVAL": 5000,
  "MAX_RECONNECT_ATTEMPTS": 10,
  "CACHE_STALE_TIME": 60000,
  "REFETCH_INTERVAL": 30000,
  "ANIMATION_DURATION": 300,
  "BREAKPOINTS": {
    "mobile": 768,
    "tablet": 1024,
    "desktop": 1280
  },
  "THEME_STORAGE_KEY": "turtle-trading-theme"
}
```