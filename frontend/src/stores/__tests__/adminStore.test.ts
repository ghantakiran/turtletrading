import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminStore } from '../adminStore';

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

describe('AdminStore', () => {
  beforeEach(() => {
    // Reset store state to match actual adminStore structure
    useAdminStore.setState({
      // Feature Flags
      featureFlags: [],
      featureFlagsLoading: false,
      featureFlagsError: null,

      // System Health
      systemHealth: [],
      healthLoading: false,
      healthError: null,
      lastHealthCheck: null,
      healthRefreshInterval: 30000,

      // Queues
      queues: [],
      queuesLoading: false,
      queuesError: null,
      jobs: [],
      jobsLoading: false,
      jobsError: null,
      jobFilters: { status: 'all', queue: 'all', timeRange: '24h' },

      // Cache
      cacheKeys: [],
      cacheLoading: false,
      cacheError: null,
      cacheFilters: { pattern: '', namespace: 'all' },

      // Alerts
      alerts: [],
      alertsLoading: false,
      alertsError: null,

      // Users & Sessions
      adminUsers: [],
      adminUsersLoading: false,
      adminUsersError: null,
      sessions: [],
      sessionsLoading: false,
      sessionsError: null,

      // UI State
      selectedService: null,
      autoRefresh: true,
      refreshInterval: 30000,
      sidebarCollapsed: false,
      selectedTab: 'overview'
    });

    // Reset mocks
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  describe('Feature Flags', () => {
    it('should fetch feature flags successfully', async () => {
      const mockFlags = [
        {
          id: 'new-ui',
          name: 'New UI',
          description: 'Enable new user interface',
          enabled: true,
          rolloutPercentage: 50,
          environment: 'production',
          conditions: [],
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-01T10:00:00Z',
          createdBy: 'admin'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: mockFlags })
      });

      const store = useAdminStore.getState();
      await store.fetchFeatureFlags();

      const state = useAdminStore.getState();
      expect(state.featureFlags).toEqual(mockFlags);
      expect(state.featureFlagsLoading).toBe(false);
      expect(state.featureFlagsError).toBeNull();
    });

    it('should handle fetch feature flags error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const store = useAdminStore.getState();
      await store.fetchFeatureFlags();

      const state = useAdminStore.getState();
      expect(state.featureFlags).toEqual([]);
      expect(state.featureFlagsLoading).toBe(false);
      expect(state.featureFlagsError).toBe('Network error');
    });
  });

  describe('System Health', () => {
    it('should fetch system health successfully', async () => {
      const mockHealth = [
        {
          service: 'database',
          status: 'healthy' as const,
          responseTime: 50,
          uptime: 86400,
          version: '1.0.0',
          dependencies: [],
          metadata: { connections: 10 },
          lastCheck: '2024-01-01T10:00:00Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockHealth })
      });

      const store = useAdminStore.getState();
      await store.fetchSystemHealth();

      const state = useAdminStore.getState();
      expect(state.systemHealth).toEqual(mockHealth);
      expect(state.healthLoading).toBe(false);
      expect(state.healthError).toBeNull();
    });

    it('should set health refresh interval', () => {
      const store = useAdminStore.getState();
      store.setHealthRefreshInterval(60000);

      const state = useAdminStore.getState();
      expect(state.healthRefreshInterval).toBe(60000);
    });
  });

  describe('Queue Management', () => {
    it('should fetch queues successfully', async () => {
      const mockQueues = [
        {
          name: 'email',
          type: 'standard',
          size: 10,
          processing: 2,
          failed: 0,
          paused: false,
          workers: 3,
          avgProcessingTime: 1000,
          lastProcessed: '2024-01-01T10:00:00Z',
          metadata: { priority: 'normal' }
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ queues: mockQueues })
      });

      const store = useAdminStore.getState();
      await store.fetchQueues();

      const state = useAdminStore.getState();
      expect(state.queues).toEqual(mockQueues);
    });

    it('should set job filters', () => {
      const store = useAdminStore.getState();
      store.setJobFilters({ status: 'failed', queue: 'email' });

      const state = useAdminStore.getState();
      expect(state.jobFilters.status).toBe('failed');
      expect(state.jobFilters.queue).toBe('email');
    });
  });

  describe('Cache Management', () => {
    it('should fetch cache keys successfully', async () => {
      const mockKeys = [
        {
          key: 'user:123',
          type: 'string',
          size: 256,
          ttl: 3600,
          lastAccessed: '2024-01-01T10:00:00Z',
          namespace: 'users',
          metadata: { encoding: 'utf8' }
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ keys: mockKeys })
      });

      const store = useAdminStore.getState();
      await store.fetchCacheKeys();

      const state = useAdminStore.getState();
      expect(state.cacheKeys).toEqual(mockKeys);
    });

    it('should set cache filters', () => {
      const store = useAdminStore.getState();
      store.setCacheFilters({ pattern: 'user:*', namespace: 'users' });

      const state = useAdminStore.getState();
      expect(state.cacheFilters.pattern).toBe('user:*');
      expect(state.cacheFilters.namespace).toBe('users');
    });
  });

  describe('Alert Management', () => {
    it('should fetch alerts successfully', async () => {
      const mockAlerts = [
        {
          id: '1',
          title: 'High Memory Usage',
          message: 'Memory usage is above 90%',
          severity: 'warning' as const,
          status: 'active' as const,
          source: 'monitoring',
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-01T10:00:00Z',
          acknowledgedAt: null,
          acknowledgedBy: null,
          resolvedAt: null,
          resolvedBy: null,
          metadata: { threshold: 90 },
          tags: ['memory', 'performance']
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts })
      });

      const store = useAdminStore.getState();
      await store.fetchAlerts();

      const state = useAdminStore.getState();
      expect(state.alerts).toEqual(mockAlerts);
    });
  });

  describe('User and Session Management', () => {
    it('should fetch admin users successfully', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin',
          isActive: true,
          lastLogin: '2024-01-01T10:00:00Z',
          permissions: ['admin:*'],
          metadata: { department: 'IT' },
          createdAt: '2024-01-01T09:00:00Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers })
      });

      const store = useAdminStore.getState();
      await store.fetchAdminUsers();

      const state = useAdminStore.getState();
      expect(state.adminUsers).toEqual(mockUsers);
    });

    it('should fetch sessions successfully', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userId: 'user-1',
          userName: 'Admin User',
          userEmail: 'admin@example.com',
          isActive: true,
          createdAt: '2024-01-01T10:00:00Z',
          lastActivity: '2024-01-01T11:00:00Z',
          expiresAt: '2024-01-02T10:00:00Z',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          location: 'San Francisco, CA',
          device: 'Desktop'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: mockSessions })
      });

      const store = useAdminStore.getState();
      await store.fetchSessions();

      const state = useAdminStore.getState();
      expect(state.sessions).toEqual(mockSessions);
    });
  });

  describe('UI Actions', () => {
    it('should set selected service', () => {
      const store = useAdminStore.getState();
      store.setSelectedService('database');

      const state = useAdminStore.getState();
      expect(state.selectedService).toBe('database');
    });

    it('should set auto refresh', () => {
      const store = useAdminStore.getState();
      store.setAutoRefresh(false);

      const state = useAdminStore.getState();
      expect(state.autoRefresh).toBe(false);
    });

    it('should set refresh interval', () => {
      const store = useAdminStore.getState();
      store.setRefreshInterval(60000);

      const state = useAdminStore.getState();
      expect(state.refreshInterval).toBe(60000);
    });

    it('should set sidebar collapsed', () => {
      const store = useAdminStore.getState();
      store.setSidebarCollapsed(true);

      const state = useAdminStore.getState();
      expect(state.sidebarCollapsed).toBe(true);
    });

    it('should set selected tab', () => {
      const store = useAdminStore.getState();
      store.setSelectedTab('health');

      const state = useAdminStore.getState();
      expect(state.selectedTab).toBe('health');
    });
  });

  describe('Utility Actions', () => {
    it('should reset errors', () => {
      // Set some errors first
      useAdminStore.setState({
        featureFlagsError: 'Some error',
        healthError: 'Health error',
        queuesError: 'Queue error'
      });

      const store = useAdminStore.getState();
      store.resetErrors();

      const state = useAdminStore.getState();
      expect(state.featureFlagsError).toBeNull();
      expect(state.healthError).toBeNull();
      expect(state.queuesError).toBeNull();
    });
  });
});