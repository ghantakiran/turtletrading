/**
 * Admin Store - Central state management for admin console
 *
 * Features:
 * - Feature flags management
 * - System health monitoring
 * - Queue and job management
 * - Cache key operations
 * - Alert management
 * - User session tracking
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

// Types
export interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  description: string;
  environments: string[];
  rolloutPercentage: number;
  targetUsers: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface SystemHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime: number;
  lastCheck: string;
  uptime: number;
  version: string;
  dependencies: HealthDependency[];
  metrics: HealthMetrics;
}

export interface HealthDependency {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  endpoint: string;
}

export interface HealthMetrics {
  cpu: number;
  memory: number;
  disk: number;
  requests: number;
  errors: number;
  activeConnections: number;
}

export interface QueueInfo {
  name: string;
  size: number;
  processing: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;
  maxRetries: number;
  deadLetterQueue: number;
  lastActivity: string;
}

export interface JobInfo {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  queue: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  data: any;
  result?: any;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  processingTime?: number;
}

export interface CacheKey {
  key: string;
  value: any;
  type: string;
  size: number;
  ttl: number;
  hits: number;
  lastAccessed: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  source: string;
  tags: string[];
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  count: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'observer';
  permissions: string[];
  lastLogin: string;
  isActive: boolean;
  sessions: UserSession[];
}

export interface UserSession {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  startTime: string;
  lastActivity: string;
  isActive: boolean;
}

// Store State
interface AdminState {
  // Feature Flags
  featureFlags: FeatureFlag[];
  featureFlagLoading: boolean;
  featureFlagError: string | null;

  // System Health
  systemHealth: SystemHealth[];
  healthLoading: boolean;
  healthError: string | null;
  healthLastUpdate: string | null;

  // Queues and Jobs
  queues: QueueInfo[];
  jobs: JobInfo[];
  queueLoading: boolean;
  jobLoading: boolean;
  queueError: string | null;
  jobError: string | null;

  // Cache Management
  cacheKeys: CacheKey[];
  cacheStats: {
    totalKeys: number;
    totalSize: number;
    hitRate: number;
    missRate: number;
    evictions: number;
  };
  cacheLoading: boolean;
  cacheError: string | null;

  // Alerts
  alerts: Alert[];
  alertsUnread: number;
  alertsLoading: boolean;
  alertsError: string | null;

  // Users and Sessions
  adminUsers: AdminUser[];
  activeSessions: UserSession[];
  usersLoading: boolean;
  usersError: string | null;

  // UI State
  selectedService: string | null;
  selectedQueue: string | null;
  selectedUser: string | null;
  dashboardRefreshInterval: number;
  autoRefresh: boolean;
}

// Store Actions
interface AdminActions {
  // Feature Flags
  fetchFeatureFlags: () => Promise<void>;
  toggleFeatureFlag: (id: string) => Promise<void>;
  updateFeatureFlagRollout: (id: string, percentage: number) => Promise<void>;
  createFeatureFlag: (flag: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  deleteFeatureFlag: (id: string) => Promise<void>;

  // System Health
  fetchSystemHealth: () => Promise<void>;
  refreshServiceHealth: (service: string) => Promise<void>;
  setHealthRefreshInterval: (interval: number) => void;

  // Queues and Jobs
  fetchQueues: () => Promise<void>;
  fetchJobs: (queue?: string, status?: string) => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  clearQueue: (queue: string) => Promise<void>;
  pauseQueue: (queue: string) => Promise<void>;
  resumeQueue: (queue: string) => Promise<void>;

  // Cache Management
  fetchCacheKeys: (pattern?: string) => Promise<void>;
  deleteCacheKey: (key: string) => Promise<void>;
  clearCachePattern: (pattern: string) => Promise<void>;
  getCacheValue: (key: string) => Promise<any>;
  setCacheValue: (key: string, value: any, ttl?: number) => Promise<void>;

  // Alerts
  fetchAlerts: () => Promise<void>;
  acknowledgeAlert: (id: string) => Promise<void>;
  resolveAlert: (id: string) => Promise<void>;
  createAlert: (alert: Omit<Alert, 'id' | 'createdAt' | 'count'>) => Promise<void>;

  // Users and Sessions
  fetchAdminUsers: () => Promise<void>;
  fetchActiveSessions: () => Promise<void>;
  terminateSession: (sessionId: string) => Promise<void>;
  updateUserRole: (userId: string, role: AdminUser['role']) => Promise<void>;
  deactivateUser: (userId: string) => Promise<void>;

  // UI Actions
  setSelectedService: (service: string | null) => void;
  setSelectedQueue: (queue: string | null) => void;
  setSelectedUser: (user: string | null) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;

  // Utility Actions
  refreshAll: () => Promise<void>;
  resetErrors: () => void;
}

// Create the store
export const useAdminStore = create<AdminState & AdminActions>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial State
        featureFlags: [],
        featureFlagLoading: false,
        featureFlagError: null,

        systemHealth: [],
        healthLoading: false,
        healthError: null,
        healthLastUpdate: null,

        queues: [],
        jobs: [],
        queueLoading: false,
        jobLoading: false,
        queueError: null,
        jobError: null,

        cacheKeys: [],
        cacheStats: {
          totalKeys: 0,
          totalSize: 0,
          hitRate: 0,
          missRate: 0,
          evictions: 0,
        },
        cacheLoading: false,
        cacheError: null,

        alerts: [],
        alertsUnread: 0,
        alertsLoading: false,
        alertsError: null,

        adminUsers: [],
        activeSessions: [],
        usersLoading: false,
        usersError: null,

        selectedService: null,
        selectedQueue: null,
        selectedUser: null,
        dashboardRefreshInterval: 30000, // 30 seconds
        autoRefresh: true,

        // Feature Flags Actions
        fetchFeatureFlags: async () => {
          set({ featureFlagLoading: true, featureFlagError: null });
          try {
            const response = await fetch('/api/v1/admin/feature-flags');
            if (!response.ok) throw new Error('Failed to fetch feature flags');
            const flags = await response.json();
            set({ featureFlags: flags, featureFlagLoading: false });
          } catch (error) {
            set({
              featureFlagError: error instanceof Error ? error.message : 'Unknown error',
              featureFlagLoading: false
            });
          }
        },

        toggleFeatureFlag: async (id: string) => {
          try {
            const response = await fetch(`/api/v1/admin/feature-flags/${id}/toggle`, {
              method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to toggle feature flag');

            const updatedFlag = await response.json();
            set(state => ({
              featureFlags: state.featureFlags.map(flag =>
                flag.id === id ? updatedFlag : flag
              )
            }));
          } catch (error) {
            set({ featureFlagError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        updateFeatureFlagRollout: async (id: string, percentage: number) => {
          try {
            const response = await fetch(`/api/v1/admin/feature-flags/${id}/rollout`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rolloutPercentage: percentage }),
            });
            if (!response.ok) throw new Error('Failed to update rollout');

            const updatedFlag = await response.json();
            set(state => ({
              featureFlags: state.featureFlags.map(flag =>
                flag.id === id ? updatedFlag : flag
              )
            }));
          } catch (error) {
            set({ featureFlagError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        createFeatureFlag: async (flagData) => {
          try {
            const response = await fetch('/api/v1/admin/feature-flags', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(flagData),
            });
            if (!response.ok) throw new Error('Failed to create feature flag');

            const newFlag = await response.json();
            set(state => ({
              featureFlags: [...state.featureFlags, newFlag]
            }));
          } catch (error) {
            set({ featureFlagError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        deleteFeatureFlag: async (id: string) => {
          try {
            const response = await fetch(`/api/v1/admin/feature-flags/${id}`, {
              method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete feature flag');

            set(state => ({
              featureFlags: state.featureFlags.filter(flag => flag.id !== id)
            }));
          } catch (error) {
            set({ featureFlagError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        // System Health Actions
        fetchSystemHealth: async () => {
          set({ healthLoading: true, healthError: null });
          try {
            const response = await fetch('/api/v1/admin/health');
            if (!response.ok) throw new Error('Failed to fetch system health');
            const health = await response.json();
            set({
              systemHealth: health,
              healthLoading: false,
              healthLastUpdate: new Date().toISOString()
            });
          } catch (error) {
            set({
              healthError: error instanceof Error ? error.message : 'Unknown error',
              healthLoading: false
            });
          }
        },

        refreshServiceHealth: async (service: string) => {
          try {
            const response = await fetch(`/api/v1/admin/health/${service}/refresh`, {
              method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to refresh service health');

            const updatedHealth = await response.json();
            set(state => ({
              systemHealth: state.systemHealth.map(h =>
                h.service === service ? updatedHealth : h
              )
            }));
          } catch (error) {
            set({ healthError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        setHealthRefreshInterval: (interval: number) => {
          set({ dashboardRefreshInterval: interval });
        },

        // Queue and Job Actions
        fetchQueues: async () => {
          set({ queueLoading: true, queueError: null });
          try {
            const response = await fetch('/api/v1/admin/queues');
            if (!response.ok) throw new Error('Failed to fetch queues');
            const queues = await response.json();
            set({ queues, queueLoading: false });
          } catch (error) {
            set({
              queueError: error instanceof Error ? error.message : 'Unknown error',
              queueLoading: false
            });
          }
        },

        fetchJobs: async (queue?: string, status?: string) => {
          set({ jobLoading: true, jobError: null });
          try {
            const params = new URLSearchParams();
            if (queue) params.append('queue', queue);
            if (status) params.append('status', status);

            const response = await fetch(`/api/v1/admin/jobs?${params}`);
            if (!response.ok) throw new Error('Failed to fetch jobs');
            const jobs = await response.json();
            set({ jobs, jobLoading: false });
          } catch (error) {
            set({
              jobError: error instanceof Error ? error.message : 'Unknown error',
              jobLoading: false
            });
          }
        },

        retryJob: async (jobId: string) => {
          try {
            const response = await fetch(`/api/v1/admin/jobs/${jobId}/retry`, {
              method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to retry job');

            // Refresh jobs list
            await get().fetchJobs();
          } catch (error) {
            set({ jobError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        cancelJob: async (jobId: string) => {
          try {
            const response = await fetch(`/api/v1/admin/jobs/${jobId}/cancel`, {
              method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to cancel job');

            // Refresh jobs list
            await get().fetchJobs();
          } catch (error) {
            set({ jobError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        clearQueue: async (queue: string) => {
          try {
            const response = await fetch(`/api/v1/admin/queues/${queue}/clear`, {
              method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to clear queue');

            // Refresh queues list
            await get().fetchQueues();
          } catch (error) {
            set({ queueError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        pauseQueue: async (queue: string) => {
          try {
            const response = await fetch(`/api/v1/admin/queues/${queue}/pause`, {
              method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to pause queue');

            // Refresh queues list
            await get().fetchQueues();
          } catch (error) {
            set({ queueError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        resumeQueue: async (queue: string) => {
          try {
            const response = await fetch(`/api/v1/admin/queues/${queue}/resume`, {
              method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to resume queue');

            // Refresh queues list
            await get().fetchQueues();
          } catch (error) {
            set({ queueError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        // Cache Management Actions
        fetchCacheKeys: async (pattern?: string) => {
          set({ cacheLoading: true, cacheError: null });
          try {
            const params = new URLSearchParams();
            if (pattern) params.append('pattern', pattern);

            const response = await fetch(`/api/v1/admin/cache/keys?${params}`);
            if (!response.ok) throw new Error('Failed to fetch cache keys');
            const data = await response.json();
            set({
              cacheKeys: data.keys,
              cacheStats: data.stats,
              cacheLoading: false
            });
          } catch (error) {
            set({
              cacheError: error instanceof Error ? error.message : 'Unknown error',
              cacheLoading: false
            });
          }
        },

        deleteCacheKey: async (key: string) => {
          try {
            const response = await fetch(`/api/v1/admin/cache/keys/${encodeURIComponent(key)}`, {
              method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete cache key');

            set(state => ({
              cacheKeys: state.cacheKeys.filter(k => k.key !== key)
            }));
          } catch (error) {
            set({ cacheError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        clearCachePattern: async (pattern: string) => {
          try {
            const response = await fetch('/api/v1/admin/cache/clear', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pattern }),
            });
            if (!response.ok) throw new Error('Failed to clear cache pattern');

            // Refresh cache keys
            await get().fetchCacheKeys();
          } catch (error) {
            set({ cacheError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        getCacheValue: async (key: string) => {
          try {
            const response = await fetch(`/api/v1/admin/cache/keys/${encodeURIComponent(key)}/value`);
            if (!response.ok) throw new Error('Failed to get cache value');
            return await response.json();
          } catch (error) {
            set({ cacheError: error instanceof Error ? error.message : 'Unknown error' });
            return null;
          }
        },

        setCacheValue: async (key: string, value: any, ttl?: number) => {
          try {
            const response = await fetch(`/api/v1/admin/cache/keys/${encodeURIComponent(key)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value, ttl }),
            });
            if (!response.ok) throw new Error('Failed to set cache value');

            // Refresh cache keys
            await get().fetchCacheKeys();
          } catch (error) {
            set({ cacheError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        // Alert Actions
        fetchAlerts: async () => {
          set({ alertsLoading: true, alertsError: null });
          try {
            const response = await fetch('/api/v1/admin/alerts');
            if (!response.ok) throw new Error('Failed to fetch alerts');
            const alerts = await response.json();
            const unread = alerts.filter((a: Alert) => !a.acknowledged).length;
            set({ alerts, alertsUnread: unread, alertsLoading: false });
          } catch (error) {
            set({
              alertsError: error instanceof Error ? error.message : 'Unknown error',
              alertsLoading: false
            });
          }
        },

        acknowledgeAlert: async (id: string) => {
          try {
            const response = await fetch(`/api/v1/admin/alerts/${id}/acknowledge`, {
              method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to acknowledge alert');

            const updatedAlert = await response.json();
            set(state => ({
              alerts: state.alerts.map(alert =>
                alert.id === id ? updatedAlert : alert
              ),
              alertsUnread: state.alertsUnread - 1
            }));
          } catch (error) {
            set({ alertsError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        resolveAlert: async (id: string) => {
          try {
            const response = await fetch(`/api/v1/admin/alerts/${id}/resolve`, {
              method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to resolve alert');

            const updatedAlert = await response.json();
            set(state => ({
              alerts: state.alerts.map(alert =>
                alert.id === id ? updatedAlert : alert
              )
            }));
          } catch (error) {
            set({ alertsError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        createAlert: async (alertData) => {
          try {
            const response = await fetch('/api/v1/admin/alerts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(alertData),
            });
            if (!response.ok) throw new Error('Failed to create alert');

            const newAlert = await response.json();
            set(state => ({
              alerts: [newAlert, ...state.alerts],
              alertsUnread: state.alertsUnread + 1
            }));
          } catch (error) {
            set({ alertsError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        // User and Session Actions
        fetchAdminUsers: async () => {
          set({ usersLoading: true, usersError: null });
          try {
            const response = await fetch('/api/v1/admin/users');
            if (!response.ok) throw new Error('Failed to fetch admin users');
            const users = await response.json();
            set({ adminUsers: users, usersLoading: false });
          } catch (error) {
            set({
              usersError: error instanceof Error ? error.message : 'Unknown error',
              usersLoading: false
            });
          }
        },

        fetchActiveSessions: async () => {
          try {
            const response = await fetch('/api/v1/admin/sessions');
            if (!response.ok) throw new Error('Failed to fetch active sessions');
            const sessions = await response.json();
            set({ activeSessions: sessions });
          } catch (error) {
            set({ usersError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        terminateSession: async (sessionId: string) => {
          try {
            const response = await fetch(`/api/v1/admin/sessions/${sessionId}/terminate`, {
              method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to terminate session');

            set(state => ({
              activeSessions: state.activeSessions.filter(s => s.id !== sessionId)
            }));
          } catch (error) {
            set({ usersError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        updateUserRole: async (userId: string, role: AdminUser['role']) => {
          try {
            const response = await fetch(`/api/v1/admin/users/${userId}/role`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role }),
            });
            if (!response.ok) throw new Error('Failed to update user role');

            const updatedUser = await response.json();
            set(state => ({
              adminUsers: state.adminUsers.map(user =>
                user.id === userId ? updatedUser : user
              )
            }));
          } catch (error) {
            set({ usersError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        deactivateUser: async (userId: string) => {
          try {
            const response = await fetch(`/api/v1/admin/users/${userId}/deactivate`, {
              method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to deactivate user');

            const updatedUser = await response.json();
            set(state => ({
              adminUsers: state.adminUsers.map(user =>
                user.id === userId ? updatedUser : user
              )
            }));
          } catch (error) {
            set({ usersError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        // UI Actions
        setSelectedService: (service: string | null) => set({ selectedService: service }),
        setSelectedQueue: (queue: string | null) => set({ selectedQueue: queue }),
        setSelectedUser: (user: string | null) => set({ selectedUser: user }),
        setAutoRefresh: (enabled: boolean) => set({ autoRefresh: enabled }),
        setRefreshInterval: (interval: number) => set({ dashboardRefreshInterval: interval }),

        // Utility Actions
        refreshAll: async () => {
          const actions = get();
          await Promise.allSettled([
            actions.fetchFeatureFlags(),
            actions.fetchSystemHealth(),
            actions.fetchQueues(),
            actions.fetchAlerts(),
            actions.fetchAdminUsers(),
            actions.fetchActiveSessions(),
          ]);
        },

        resetErrors: () => set({
          featureFlagError: null,
          healthError: null,
          queueError: null,
          jobError: null,
          cacheError: null,
          alertsError: null,
          usersError: null,
        }),
      }),
      {
        name: 'turtle-admin-store',
        partialize: (state) => ({
          dashboardRefreshInterval: state.dashboardRefreshInterval,
          autoRefresh: state.autoRefresh,
          selectedService: state.selectedService,
          selectedQueue: state.selectedQueue,
        }),
      }
    )
  )
);

// Computed selectors
export const useAdminSelectors = () => ({
  // Feature flag selectors
  enabledFeatureFlags: useAdminStore(state =>
    state.featureFlags.filter(flag => flag.enabled)
  ),

  // Health selectors
  unhealthyServices: useAdminStore(state =>
    state.systemHealth.filter(health => health.status !== 'healthy')
  ),

  overallSystemStatus: useAdminStore(state => {
    const healths = state.systemHealth;
    if (healths.length === 0) return 'unknown';
    if (healths.some(h => h.status === 'unhealthy')) return 'unhealthy';
    if (healths.some(h => h.status === 'degraded')) return 'degraded';
    return 'healthy';
  }),

  // Queue selectors
  busyQueues: useAdminStore(state =>
    state.queues.filter(queue => queue.processing > 0)
  ),

  failedJobs: useAdminStore(state =>
    state.jobs.filter(job => job.status === 'failed')
  ),

  // Alert selectors
  criticalAlerts: useAdminStore(state =>
    state.alerts.filter(alert => alert.level === 'critical' && !alert.resolved)
  ),

  unacknowledgedAlerts: useAdminStore(state =>
    state.alerts.filter(alert => !alert.acknowledged && !alert.resolved)
  ),

  // User selectors
  activeAdminUsers: useAdminStore(state =>
    state.adminUsers.filter(user => user.isActive)
  ),

  recentSessions: useAdminStore(state =>
    state.activeSessions.sort((a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    ).slice(0, 10)
  ),
});