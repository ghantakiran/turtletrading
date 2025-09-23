/**
 * Observability Store - Real-time monitoring and analysis
 *
 * Features:
 * - Live log streaming
 * - Distributed tracing
 * - Metrics dashboards
 * - Correlation search
 * - Performance analytics
 * - Error tracking
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Types
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  source: string;
  service: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  requestId?: string;
  metadata: Record<string, any>;
  tags: string[];
  stackTrace?: string;
}

export interface Trace {
  traceId: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  rootSpan: Span;
  spans: Span[];
  services: string[];
  errorCount: number;
  tags: Record<string, string>;
}

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'ok' | 'error' | 'timeout';
  tags: Record<string, any>;
  logs: SpanLog[];
  children: Span[];
}

export interface SpanLog {
  timestamp: string;
  level: string;
  message: string;
  fields: Record<string, any>;
}

export interface MetricSeries {
  name: string;
  labels: Record<string, string>;
  values: MetricPoint[];
  unit: string;
  type: 'gauge' | 'counter' | 'histogram' | 'summary';
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  panels: DashboardPanel[];
  timeRange: TimeRange;
  refreshInterval: number;
  tags: string[];
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardPanel {
  id: string;
  title: string;
  type: 'graph' | 'table' | 'stat' | 'gauge' | 'heatmap' | 'logs';
  gridPos: { x: number; y: number; w: number; h: number };
  targets: MetricQuery[];
  options: Record<string, any>;
  fieldConfig: Record<string, any>;
}

export interface MetricQuery {
  expr: string;
  legendFormat?: string;
  interval?: string;
  refId: string;
}

export interface TimeRange {
  from: string;
  to: string;
}

export interface SearchFilter {
  timeRange: TimeRange;
  services: string[];
  levels: string[];
  traceId?: string;
  userId?: string;
  query?: string;
  tags: string[];
}

export interface CorrelationResult {
  id: string;
  type: 'log-trace' | 'metric-log' | 'trace-metric' | 'error-pattern';
  confidence: number;
  description: string;
  items: CorrelationItem[];
  timeRange: TimeRange;
  suggestions: string[];
}

export interface CorrelationItem {
  type: 'log' | 'trace' | 'metric' | 'alert';
  id: string;
  timestamp: string;
  relevance: number;
  data: any;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  expr: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'ne';
  duration: string;
  severity: 'info' | 'warning' | 'critical';
  labels: Record<string, string>;
  annotations: Record<string, string>;
  enabled: boolean;
  evaluationInterval: string;
  lastEvaluation?: string;
  state: 'pending' | 'firing' | 'resolved';
}

// Store State
interface ObservabilityState {
  // Logs
  logs: LogEntry[];
  logsLoading: boolean;
  logsError: string | null;
  logStream: boolean;
  logFilters: SearchFilter;

  // Traces
  traces: Trace[];
  selectedTrace: Trace | null;
  tracesLoading: boolean;
  tracesError: string | null;

  // Metrics
  metrics: MetricSeries[];
  metricsLoading: boolean;
  metricsError: string | null;
  selectedTimeRange: TimeRange;

  // Dashboards
  dashboards: Dashboard[];
  selectedDashboard: Dashboard | null;
  dashboardsLoading: boolean;
  dashboardsError: string | null;

  // Correlation
  correlations: CorrelationResult[];
  correlationLoading: boolean;
  correlationError: string | null;

  // Alert Rules
  alertRules: AlertRule[];
  alertRulesLoading: boolean;
  alertRulesError: string | null;

  // Search
  searchQuery: string;
  searchResults: any[];
  searchLoading: boolean;
  searchError: string | null;

  // UI State
  sidebarOpen: boolean;
  selectedPanel: string | null;
  autoRefresh: boolean;
  refreshInterval: number;
}

// Store Actions
interface ObservabilityActions {
  // Logs
  fetchLogs: (filters?: Partial<SearchFilter>) => Promise<void>;
  startLogStream: () => void;
  stopLogStream: () => void;
  setLogFilters: (filters: Partial<SearchFilter>) => void;
  clearLogs: () => void;

  // Traces
  fetchTraces: (filters?: Partial<SearchFilter>) => Promise<void>;
  fetchTrace: (traceId: string) => Promise<void>;
  setSelectedTrace: (trace: Trace | null) => void;

  // Metrics
  fetchMetrics: (queries: MetricQuery[], timeRange: TimeRange) => Promise<void>;
  setTimeRange: (timeRange: TimeRange) => void;
  getMetricsSuggestions: (partial: string) => Promise<string[]>;

  // Dashboards
  fetchDashboards: () => Promise<void>;
  fetchDashboard: (id: string) => Promise<void>;
  createDashboard: (dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateDashboard: (id: string, updates: Partial<Dashboard>) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  setSelectedDashboard: (dashboard: Dashboard | null) => void;

  // Correlation
  findCorrelations: (item: { type: string; id: string; timestamp: string }) => Promise<void>;
  clearCorrelations: () => void;

  // Alert Rules
  fetchAlertRules: () => Promise<void>;
  createAlertRule: (rule: Omit<AlertRule, 'id' | 'lastEvaluation' | 'state'>) => Promise<void>;
  updateAlertRule: (id: string, updates: Partial<AlertRule>) => Promise<void>;
  deleteAlertRule: (id: string) => Promise<void>;
  testAlertRule: (expr: string) => Promise<any>;

  // Search
  search: (query: string, filters?: Partial<SearchFilter>) => Promise<void>;
  clearSearch: () => void;

  // UI Actions
  setSidebarOpen: (open: boolean) => void;
  setSelectedPanel: (panel: string | null) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
}

// WebSocket connection for real-time logs
let logWebSocket: WebSocket | null = null;

// Create the store
export const useObservabilityStore = create<ObservabilityState & ObservabilityActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    logs: [],
    logsLoading: false,
    logsError: null,
    logStream: false,
    logFilters: {
      timeRange: { from: 'now-1h', to: 'now' },
      services: [],
      levels: [],
      tags: [],
    },

    traces: [],
    selectedTrace: null,
    tracesLoading: false,
    tracesError: null,

    metrics: [],
    metricsLoading: false,
    metricsError: null,
    selectedTimeRange: { from: 'now-1h', to: 'now' },

    dashboards: [],
    selectedDashboard: null,
    dashboardsLoading: false,
    dashboardsError: null,

    correlations: [],
    correlationLoading: false,
    correlationError: null,

    alertRules: [],
    alertRulesLoading: false,
    alertRulesError: null,

    searchQuery: '',
    searchResults: [],
    searchLoading: false,
    searchError: null,

    sidebarOpen: true,
    selectedPanel: null,
    autoRefresh: true,
    refreshInterval: 30000,

    // Logs Actions
    fetchLogs: async (filters?: Partial<SearchFilter>) => {
      set({ logsLoading: true, logsError: null });
      try {
        const currentFilters = get().logFilters;
        const mergedFilters = { ...currentFilters, ...filters };

        const response = await fetch('/api/v1/admin/observability/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mergedFilters),
        });

        if (!response.ok) throw new Error('Failed to fetch logs');
        const logs = await response.json();
        set({ logs, logsLoading: false });
      } catch (error) {
        set({
          logsError: error instanceof Error ? error.message : 'Unknown error',
          logsLoading: false
        });
      }
    },

    startLogStream: () => {
      if (logWebSocket) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/admin/observability/logs/stream`;

      logWebSocket = new WebSocket(wsUrl);

      logWebSocket.onopen = () => {
        set({ logStream: true });
        console.log('Log stream connected');
      };

      logWebSocket.onmessage = (event) => {
        const logEntry = JSON.parse(event.data);
        set(state => ({
          logs: [logEntry, ...state.logs].slice(0, 1000) // Keep last 1000 logs
        }));
      };

      logWebSocket.onclose = () => {
        set({ logStream: false });
        logWebSocket = null;
        console.log('Log stream disconnected');
      };

      logWebSocket.onerror = (error) => {
        set({ logsError: 'WebSocket connection error' });
        console.error('Log stream error:', error);
      };
    },

    stopLogStream: () => {
      if (logWebSocket) {
        logWebSocket.close();
        logWebSocket = null;
      }
      set({ logStream: false });
    },

    setLogFilters: (filters: Partial<SearchFilter>) => {
      set(state => ({
        logFilters: { ...state.logFilters, ...filters }
      }));
    },

    clearLogs: () => set({ logs: [] }),

    // Traces Actions
    fetchTraces: async (filters?: Partial<SearchFilter>) => {
      set({ tracesLoading: true, tracesError: null });
      try {
        const currentFilters = get().logFilters;
        const mergedFilters = { ...currentFilters, ...filters };

        const response = await fetch('/api/v1/admin/observability/traces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mergedFilters),
        });

        if (!response.ok) throw new Error('Failed to fetch traces');
        const traces = await response.json();
        set({ traces, tracesLoading: false });
      } catch (error) {
        set({
          tracesError: error instanceof Error ? error.message : 'Unknown error',
          tracesLoading: false
        });
      }
    },

    fetchTrace: async (traceId: string) => {
      set({ tracesLoading: true, tracesError: null });
      try {
        const response = await fetch(`/api/v1/admin/observability/traces/${traceId}`);
        if (!response.ok) throw new Error('Failed to fetch trace');
        const trace = await response.json();
        set({ selectedTrace: trace, tracesLoading: false });
      } catch (error) {
        set({
          tracesError: error instanceof Error ? error.message : 'Unknown error',
          tracesLoading: false
        });
      }
    },

    setSelectedTrace: (trace: Trace | null) => set({ selectedTrace: trace }),

    // Metrics Actions
    fetchMetrics: async (queries: MetricQuery[], timeRange: TimeRange) => {
      set({ metricsLoading: true, metricsError: null });
      try {
        const response = await fetch('/api/v1/admin/observability/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queries, timeRange }),
        });

        if (!response.ok) throw new Error('Failed to fetch metrics');
        const metrics = await response.json();
        set({ metrics, metricsLoading: false, selectedTimeRange: timeRange });
      } catch (error) {
        set({
          metricsError: error instanceof Error ? error.message : 'Unknown error',
          metricsLoading: false
        });
      }
    },

    setTimeRange: (timeRange: TimeRange) => set({ selectedTimeRange: timeRange }),

    getMetricsSuggestions: async (partial: string) => {
      try {
        const response = await fetch(`/api/v1/admin/observability/metrics/suggest?q=${encodeURIComponent(partial)}`);
        if (!response.ok) throw new Error('Failed to get suggestions');
        return await response.json();
      } catch (error) {
        console.error('Failed to get metric suggestions:', error);
        return [];
      }
    },

    // Dashboards Actions
    fetchDashboards: async () => {
      set({ dashboardsLoading: true, dashboardsError: null });
      try {
        const response = await fetch('/api/v1/admin/observability/dashboards');
        if (!response.ok) throw new Error('Failed to fetch dashboards');
        const dashboards = await response.json();
        set({ dashboards, dashboardsLoading: false });
      } catch (error) {
        set({
          dashboardsError: error instanceof Error ? error.message : 'Unknown error',
          dashboardsLoading: false
        });
      }
    },

    fetchDashboard: async (id: string) => {
      set({ dashboardsLoading: true, dashboardsError: null });
      try {
        const response = await fetch(`/api/v1/admin/observability/dashboards/${id}`);
        if (!response.ok) throw new Error('Failed to fetch dashboard');
        const dashboard = await response.json();
        set({ selectedDashboard: dashboard, dashboardsLoading: false });
      } catch (error) {
        set({
          dashboardsError: error instanceof Error ? error.message : 'Unknown error',
          dashboardsLoading: false
        });
      }
    },

    createDashboard: async (dashboardData) => {
      try {
        const response = await fetch('/api/v1/admin/observability/dashboards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dashboardData),
        });
        if (!response.ok) throw new Error('Failed to create dashboard');

        const newDashboard = await response.json();
        set(state => ({
          dashboards: [...state.dashboards, newDashboard]
        }));
      } catch (error) {
        set({ dashboardsError: error instanceof Error ? error.message : 'Unknown error' });
      }
    },

    updateDashboard: async (id: string, updates: Partial<Dashboard>) => {
      try {
        const response = await fetch(`/api/v1/admin/observability/dashboards/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error('Failed to update dashboard');

        const updatedDashboard = await response.json();
        set(state => ({
          dashboards: state.dashboards.map(d => d.id === id ? updatedDashboard : d),
          selectedDashboard: state.selectedDashboard?.id === id ? updatedDashboard : state.selectedDashboard
        }));
      } catch (error) {
        set({ dashboardsError: error instanceof Error ? error.message : 'Unknown error' });
      }
    },

    deleteDashboard: async (id: string) => {
      try {
        const response = await fetch(`/api/v1/admin/observability/dashboards/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete dashboard');

        set(state => ({
          dashboards: state.dashboards.filter(d => d.id !== id),
          selectedDashboard: state.selectedDashboard?.id === id ? null : state.selectedDashboard
        }));
      } catch (error) {
        set({ dashboardsError: error instanceof Error ? error.message : 'Unknown error' });
      }
    },

    setSelectedDashboard: (dashboard: Dashboard | null) => set({ selectedDashboard: dashboard }),

    // Correlation Actions
    findCorrelations: async (item: { type: string; id: string; timestamp: string }) => {
      set({ correlationLoading: true, correlationError: null });
      try {
        const response = await fetch('/api/v1/admin/observability/correlations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });

        if (!response.ok) throw new Error('Failed to find correlations');
        const correlations = await response.json();
        set({ correlations, correlationLoading: false });
      } catch (error) {
        set({
          correlationError: error instanceof Error ? error.message : 'Unknown error',
          correlationLoading: false
        });
      }
    },

    clearCorrelations: () => set({ correlations: [] }),

    // Alert Rules Actions
    fetchAlertRules: async () => {
      set({ alertRulesLoading: true, alertRulesError: null });
      try {
        const response = await fetch('/api/v1/admin/observability/alert-rules');
        if (!response.ok) throw new Error('Failed to fetch alert rules');
        const alertRules = await response.json();
        set({ alertRules, alertRulesLoading: false });
      } catch (error) {
        set({
          alertRulesError: error instanceof Error ? error.message : 'Unknown error',
          alertRulesLoading: false
        });
      }
    },

    createAlertRule: async (ruleData) => {
      try {
        const response = await fetch('/api/v1/admin/observability/alert-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleData),
        });
        if (!response.ok) throw new Error('Failed to create alert rule');

        const newRule = await response.json();
        set(state => ({
          alertRules: [...state.alertRules, newRule]
        }));
      } catch (error) {
        set({ alertRulesError: error instanceof Error ? error.message : 'Unknown error' });
      }
    },

    updateAlertRule: async (id: string, updates: Partial<AlertRule>) => {
      try {
        const response = await fetch(`/api/v1/admin/observability/alert-rules/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error('Failed to update alert rule');

        const updatedRule = await response.json();
        set(state => ({
          alertRules: state.alertRules.map(rule => rule.id === id ? updatedRule : rule)
        }));
      } catch (error) {
        set({ alertRulesError: error instanceof Error ? error.message : 'Unknown error' });
      }
    },

    deleteAlertRule: async (id: string) => {
      try {
        const response = await fetch(`/api/v1/admin/observability/alert-rules/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete alert rule');

        set(state => ({
          alertRules: state.alertRules.filter(rule => rule.id !== id)
        }));
      } catch (error) {
        set({ alertRulesError: error instanceof Error ? error.message : 'Unknown error' });
      }
    },

    testAlertRule: async (expr: string) => {
      try {
        const response = await fetch('/api/v1/admin/observability/alert-rules/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expr }),
        });
        if (!response.ok) throw new Error('Failed to test alert rule');
        return await response.json();
      } catch (error) {
        set({ alertRulesError: error instanceof Error ? error.message : 'Unknown error' });
        return null;
      }
    },

    // Search Actions
    search: async (query: string, filters?: Partial<SearchFilter>) => {
      set({ searchLoading: true, searchError: null, searchQuery: query });
      try {
        const currentFilters = get().logFilters;
        const mergedFilters = { ...currentFilters, ...filters, query };

        const response = await fetch('/api/v1/admin/observability/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mergedFilters),
        });

        if (!response.ok) throw new Error('Failed to search');
        const results = await response.json();
        set({ searchResults: results, searchLoading: false });
      } catch (error) {
        set({
          searchError: error instanceof Error ? error.message : 'Unknown error',
          searchLoading: false
        });
      }
    },

    clearSearch: () => set({ searchQuery: '', searchResults: [] }),

    // UI Actions
    setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
    setSelectedPanel: (panel: string | null) => set({ selectedPanel: panel }),
    setAutoRefresh: (enabled: boolean) => set({ autoRefresh: enabled }),
    setRefreshInterval: (interval: number) => set({ refreshInterval: interval }),
  }))
);

// Computed selectors
export const useObservabilitySelectors = () => ({
  // Log selectors
  errorLogs: useObservabilityStore(state =>
    state.logs.filter(log => log.level === 'error' || log.level === 'fatal')
  ),

  logsByService: useObservabilityStore(state => {
    const services: Record<string, number> = {};
    state.logs.forEach(log => {
      services[log.service] = (services[log.service] || 0) + 1;
    });
    return services;
  }),

  // Trace selectors
  slowTraces: useObservabilityStore(state =>
    state.traces.filter(trace => trace.duration > 1000) // > 1 second
  ),

  errorTraces: useObservabilityStore(state =>
    state.traces.filter(trace => trace.status === 'error')
  ),

  // Alert selectors
  firingAlerts: useObservabilityStore(state =>
    state.alertRules.filter(rule => rule.state === 'firing')
  ),

  enabledAlertRules: useObservabilityStore(state =>
    state.alertRules.filter(rule => rule.enabled)
  ),

  // Dashboard selectors
  publicDashboards: useObservabilityStore(state =>
    state.dashboards.filter(dashboard => dashboard.isPublic)
  ),

  recentDashboards: useObservabilityStore(state =>
    state.dashboards
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
  ),
});