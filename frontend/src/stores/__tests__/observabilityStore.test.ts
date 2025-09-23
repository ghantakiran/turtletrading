import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useObservabilityStore } from '../observabilityStore';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
  send: vi.fn(),
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null,
  readyState: WebSocket.CONNECTING,
}));

describe('ObservabilityStore', () => {
  beforeEach(() => {
    // Reset store state
    useObservabilityStore.setState({
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
    });

    // Reset mocks
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  describe('Log Management', () => {
    it('should fetch logs successfully', async () => {
      const mockLogs = [
        {
          id: '1',
          timestamp: '2024-01-01T10:00:00Z',
          level: 'info' as const,
          message: 'Test log message',
          source: 'api-server',
          service: 'api',
          traceId: 'trace-1',
          spanId: 'span-1',
          metadata: { userId: '123' },
          tags: ['test']
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLogs
      });

      const store = useObservabilityStore.getState();
      await store.fetchLogs();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/admin/observability/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeRange: { from: 'now-1h', to: 'now' },
          services: [],
          levels: [],
          tags: []
        })
      });

      const state = useObservabilityStore.getState();
      expect(state.logs).toEqual(mockLogs);
      expect(state.logsLoading).toBe(false);
      expect(state.logsError).toBeNull();
    });

    it('should handle fetch logs error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const store = useObservabilityStore.getState();
      await store.fetchLogs();

      const state = useObservabilityStore.getState();
      expect(state.logs).toEqual([]);
      expect(state.logsLoading).toBe(false);
      expect(state.logsError).toBe('Network error');
    });

    it('should set log filters', () => {
      const store = useObservabilityStore.getState();
      store.setLogFilters({ levels: ['error'], services: ['api'] });

      const state = useObservabilityStore.getState();
      expect(state.logFilters.levels).toEqual(['error']);
      expect(state.logFilters.services).toEqual(['api']);
    });

    it('should clear logs', () => {
      // Set some logs first
      useObservabilityStore.setState({
        logs: [
          {
            id: '1',
            timestamp: '2024-01-01T10:00:00Z',
            level: 'info',
            message: 'Test',
            source: 'api',
            service: 'api',
            metadata: {},
            tags: []
          }
        ]
      });

      const store = useObservabilityStore.getState();
      store.clearLogs();

      const state = useObservabilityStore.getState();
      expect(state.logs).toEqual([]);
    });
  });

  describe('Trace Management', () => {
    it('should fetch traces successfully', async () => {
      const mockTraces = [
        {
          traceId: 'trace-1',
          startTime: '2024-01-01T10:00:00Z',
          endTime: '2024-01-01T10:00:01Z',
          duration: 1000,
          status: 'success' as const,
          rootSpan: {
            spanId: 'span-1',
            traceId: 'trace-1',
            operationName: 'get_user',
            startTime: '2024-01-01T10:00:00Z',
            endTime: '2024-01-01T10:00:01Z',
            duration: 1000,
            tags: {},
            logs: [],
            status: 'ok'
          },
          spans: [],
          services: ['api'],
          errorCount: 0,
          tags: {}
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTraces
      });

      const store = useObservabilityStore.getState();
      await store.fetchTraces();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/admin/observability/traces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeRange: { from: 'now-1h', to: 'now' },
          services: [],
          levels: [],
          tags: []
        })
      });

      const state = useObservabilityStore.getState();
      expect(state.traces).toEqual(mockTraces);
    });

    it('should set selected trace', () => {
      const trace = {
        traceId: 'trace-1',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T10:00:01Z',
        duration: 1000,
        status: 'success' as const,
        rootSpan: {
          spanId: 'span-1',
          traceId: 'trace-1',
          operationName: 'test',
          startTime: '2024-01-01T10:00:00Z',
          endTime: '2024-01-01T10:00:01Z',
          duration: 1000,
          tags: {},
          logs: [],
          status: 'ok'
        },
        spans: [],
        services: ['api'],
        errorCount: 0,
        tags: {}
      };

      const store = useObservabilityStore.getState();
      store.setSelectedTrace(trace);

      const state = useObservabilityStore.getState();
      expect(state.selectedTrace).toEqual(trace);
    });
  });

  describe('Dashboard Management', () => {
    it('should fetch dashboards successfully', async () => {
      const mockDashboards = [
        {
          id: '1',
          title: 'API Performance',
          description: 'API metrics dashboard',
          tags: ['api', 'performance'],
          panels: [],
          timeRange: { from: 'now-1h', to: 'now' },
          refreshInterval: '30s',
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-01T10:00:00Z',
          createdBy: 'admin',
          isPublic: true,
          variables: {}
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ dashboards: mockDashboards })
      });

      const store = useObservabilityStore.getState();
      await store.fetchDashboards();

      const state = useObservabilityStore.getState();
      expect(state.dashboards).toEqual(mockDashboards);
    });

    it('should set selected dashboard', () => {
      const dashboard = {
        id: '1',
        title: 'Test Dashboard',
        description: 'Test',
        tags: [],
        panels: [],
        timeRange: { from: 'now-1h', to: 'now' },
        refreshInterval: '30s',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
        createdBy: 'admin',
        isPublic: true,
        variables: {}
      };

      const store = useObservabilityStore.getState();
      store.setSelectedDashboard(dashboard);

      const state = useObservabilityStore.getState();
      expect(state.selectedDashboard).toEqual(dashboard);
    });
  });

  describe('UI Actions', () => {
    it('should set sidebar open state', () => {
      const store = useObservabilityStore.getState();
      store.setSidebarOpen(false);

      const state = useObservabilityStore.getState();
      expect(state.sidebarOpen).toBe(false);
    });

    it('should set selected panel', () => {
      const store = useObservabilityStore.getState();
      store.setSelectedPanel('metrics');

      const state = useObservabilityStore.getState();
      expect(state.selectedPanel).toBe('metrics');
    });

    it('should set auto refresh', () => {
      const store = useObservabilityStore.getState();
      store.setAutoRefresh(false);

      const state = useObservabilityStore.getState();
      expect(state.autoRefresh).toBe(false);
    });

    it('should set refresh interval', () => {
      const store = useObservabilityStore.getState();
      store.setRefreshInterval(60000);

      const state = useObservabilityStore.getState();
      expect(state.refreshInterval).toBe(60000);
    });
  });

  describe('Time Range Management', () => {
    it('should set time range', () => {
      const timeRange = { from: 'now-6h', to: 'now' };

      const store = useObservabilityStore.getState();
      store.setTimeRange(timeRange);

      const state = useObservabilityStore.getState();
      expect(state.selectedTimeRange).toEqual(timeRange);
    });
  });

  describe('Search and Correlation', () => {
    it('should perform search', async () => {
      const mockResults = [
        {
          id: '1',
          type: 'log',
          timestamp: '2024-01-01T10:00:00Z',
          content: 'Error message',
          service: 'api',
          relevance: 0.9
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockResults })
      });

      const store = useObservabilityStore.getState();
      await store.search('error');

      const state = useObservabilityStore.getState();
      expect(state.searchResults).toEqual(mockResults);
      expect(state.searchQuery).toBe('error');
    });

    it('should clear search results', () => {
      useObservabilityStore.setState({
        searchResults: [{ id: '1', type: 'log', timestamp: '2024-01-01T10:00:00Z', content: 'test', service: 'api', relevance: 0.9 }],
        searchQuery: 'test'
      });

      const store = useObservabilityStore.getState();
      store.clearSearch();

      const state = useObservabilityStore.getState();
      expect(state.searchResults).toEqual([]);
      expect(state.searchQuery).toBe('');
    });
  });
});