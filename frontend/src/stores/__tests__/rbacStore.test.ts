import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRBACStore } from '../rbacStore';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('RBACStore', () => {
  beforeEach(() => {
    // Reset store state to match the actual store structure
    useRBACStore.setState({
      // Users
      users: [],
      usersLoading: false,
      usersError: null,
      selectedUser: null,
      userFilters: { search: '', role: '', status: 'all' },

      // Roles
      roles: [],
      rolesLoading: false,
      rolesError: null,
      selectedRole: null,

      // Permissions
      permissions: [],
      permissionsLoading: false,
      permissionsError: null,

      // Audit
      auditLogs: [],
      auditLoading: false,
      auditError: null,
      auditFilters: {
        timeRange: { from: 'now-24h', to: 'now' },
        users: [],
        actions: [],
        resources: [],
        search: ''
      },

      // Access Requests
      accessRequests: [],
      accessRequestsLoading: false,
      accessRequestsError: null,

      // Rate Limit Overrides
      rateLimitOverrides: [],
      rateLimitOverridesLoading: false,
      rateLimitOverridesError: null,

      // Compliance
      complianceReports: [],
      complianceLoading: false,
      complianceError: null,

      // Current User Context
      currentUserId: null,
      currentUserRoles: [],
      currentUserPermissions: [],
      permissionCache: {},

      // UI State
      sidebarOpen: true,
      selectedTab: 'users',
      bulkSelection: [],
      showAdvancedFilters: false
    });

    // Reset mocks
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  describe('User Management', () => {
    it('should fetch users successfully', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'admin@example.com',
          name: 'Admin User',
          roleIds: ['admin'],
          permissions: ['admin:*'],
          isActive: true,
          lastLogin: '2024-01-01T10:00:00Z',
          metadata: { department: 'IT' },
          createdAt: '2024-01-01T09:00:00Z',
          updatedAt: '2024-01-01T10:00:00Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers })
      });

      const store = useRBACStore.getState();
      await store.fetchUsers();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/admin/rbac/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: '', role: '', status: 'all' })
      });

      const state = useRBACStore.getState();
      expect(state.users).toEqual(mockUsers);
      expect(state.usersLoading).toBe(false);
      expect(state.usersError).toBeNull();
    });

    it('should handle fetch users error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const store = useRBACStore.getState();
      await store.fetchUsers();

      const state = useRBACStore.getState();
      expect(state.users).toEqual([]);
      expect(state.usersLoading).toBe(false);
      expect(state.usersError).toBe('Network error');
    });

    it('should set selected user', () => {
      const user = {
        id: '1',
        email: 'user@example.com',
        name: 'Test User',
        roleIds: ['user'],
        permissions: ['content:read'],
        isActive: true,
        lastLogin: '2024-01-01T10:00:00Z',
        metadata: {},
        createdAt: '2024-01-01T09:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z'
      };

      const store = useRBACStore.getState();
      store.setSelectedUser(user);

      const state = useRBACStore.getState();
      expect(state.selectedUser).toEqual(user);
    });

    it('should set user filters', () => {
      const store = useRBACStore.getState();
      store.setUserFilters({ search: 'admin', role: 'admin' });

      const state = useRBACStore.getState();
      expect(state.userFilters.search).toBe('admin');
      expect(state.userFilters.role).toBe('admin');
    });
  });

  describe('Role Management', () => {
    it('should fetch roles successfully', async () => {
      const mockRoles = [
        {
          id: 'admin',
          name: 'Administrator',
          description: 'Full system access',
          permissionIds: ['admin:*'],
          isBuiltIn: true,
          userCount: 1,
          metadata: { color: '#ff0000' },
          createdAt: '2024-01-01T09:00:00Z',
          updatedAt: '2024-01-01T10:00:00Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ roles: mockRoles })
      });

      const store = useRBACStore.getState();
      await store.fetchRoles();

      const state = useRBACStore.getState();
      expect(state.roles).toEqual(mockRoles);
    });

    it('should set selected role', () => {
      const role = {
        id: 'editor',
        name: 'Editor',
        description: 'Content editing access',
        permissionIds: ['content:write'],
        isBuiltIn: false,
        userCount: 5,
        metadata: {},
        createdAt: '2024-01-01T09:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z'
      };

      const store = useRBACStore.getState();
      store.setSelectedRole(role);

      const state = useRBACStore.getState();
      expect(state.selectedRole).toEqual(role);
    });
  });

  describe('Permission Management', () => {
    it('should fetch permissions successfully', async () => {
      const mockPermissions = [
        {
          id: 'admin:users:read',
          name: 'Read Users',
          description: 'View user information',
          resource: 'users',
          action: 'read',
          scope: 'admin',
          conditions: [],
          isBuiltIn: true,
          riskLevel: 'low' as const,
          category: 'user_management',
          dependencies: [],
          createdAt: '2024-01-01T09:00:00Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ permissions: mockPermissions })
      });

      const store = useRBACStore.getState();
      await store.fetchPermissions();

      const state = useRBACStore.getState();
      expect(state.permissions).toEqual(mockPermissions);
    });
  });

  describe('Audit Trail', () => {
    it('should fetch audit logs successfully', async () => {
      const mockLogs = [
        {
          id: '1',
          timestamp: '2024-01-01T10:00:00Z',
          userId: 'user-1',
          userName: 'Admin User',
          userEmail: 'admin@example.com',
          action: 'user.created',
          resource: 'users',
          resourceId: 'user-2',
          oldValues: null,
          newValues: { email: 'newuser@example.com' },
          metadata: { source: 'admin_panel' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          sessionId: 'session-123',
          correlationId: 'corr-456'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ logs: mockLogs })
      });

      const store = useRBACStore.getState();
      await store.fetchAuditLogs();

      const state = useRBACStore.getState();
      expect(state.auditLogs).toEqual(mockLogs);
    });

    it('should set audit filters', () => {
      const filters = {
        users: ['user-1'],
        actions: ['user.created'],
        search: 'admin'
      };

      const store = useRBACStore.getState();
      store.setAuditFilters(filters);

      const state = useRBACStore.getState();
      expect(state.auditFilters.users).toEqual(['user-1']);
      expect(state.auditFilters.actions).toEqual(['user.created']);
      expect(state.auditFilters.search).toBe('admin');
    });
  });

  describe('Access Requests', () => {
    it('should fetch access requests successfully', async () => {
      const mockRequests = [
        {
          id: '1',
          userId: 'user-1',
          userName: 'User Name',
          userEmail: 'user@example.com',
          requestType: 'role_access' as const,
          requestedRoleIds: ['admin'],
          requestedPermissionIds: [],
          currentRoleIds: ['user'],
          currentPermissionIds: ['content:read'],
          reason: 'Need admin access for project',
          justification: 'Working on critical system upgrade',
          urgency: 'medium' as const,
          expirationDate: '2024-02-01T00:00:00Z',
          status: 'pending' as const,
          submittedAt: '2024-01-01T10:00:00Z',
          reviewedAt: null,
          reviewedBy: null,
          reviewerComment: null,
          autoApprovalEligible: false,
          riskScore: 0.7,
          metadata: { department: 'Engineering' }
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ requests: mockRequests })
      });

      const store = useRBACStore.getState();
      await store.fetchAccessRequests();

      const state = useRBACStore.getState();
      expect(state.accessRequests).toEqual(mockRequests);
    });
  });

  describe('Permission Checking', () => {
    it('should check permissions correctly', () => {
      // Set up user context
      useRBACStore.setState({
        currentUserId: 'user-1',
        currentUserRoles: ['admin'],
        currentUserPermissions: ['admin:*', 'users:read', 'users:write'],
        permissionCache: {
          'admin:users:read': true,
          'admin:users:write': true,
          'content:delete': false
        }
      });

      const store = useRBACStore.getState();

      expect(store.hasPermission('admin:users:read')).toBe(true);
      expect(store.hasPermission('admin:users:write')).toBe(true);
      expect(store.hasPermission('content:delete')).toBe(false);
    });

    it('should check roles correctly', () => {
      useRBACStore.setState({
        currentUserRoles: ['admin', 'editor']
      });

      const store = useRBACStore.getState();

      expect(store.hasRole('admin')).toBe(true);
      expect(store.hasRole('editor')).toBe(true);
      expect(store.hasRole('viewer')).toBe(false);
    });

    it('should check any role correctly', () => {
      useRBACStore.setState({
        currentUserRoles: ['editor']
      });

      const store = useRBACStore.getState();

      expect(store.hasAnyRole(['admin', 'editor', 'viewer'])).toBe(true);
      expect(store.hasAnyRole(['admin', 'viewer'])).toBe(false);
    });
  });

  describe('UI State Management', () => {
    it('should set sidebar open state', () => {
      const store = useRBACStore.getState();
      store.setSidebarOpen(false);

      const state = useRBACStore.getState();
      expect(state.sidebarOpen).toBe(false);
    });

    it('should set selected tab', () => {
      const store = useRBACStore.getState();
      store.setSelectedTab('roles');

      const state = useRBACStore.getState();
      expect(state.selectedTab).toBe('roles');
    });

    it('should manage bulk selection', () => {
      const store = useRBACStore.getState();

      store.setBulkSelection(['user-1', 'user-2']);
      expect(useRBACStore.getState().bulkSelection).toEqual(['user-1', 'user-2']);

      store.clearBulkSelection();
      expect(useRBACStore.getState().bulkSelection).toEqual([]);
    });

    it('should toggle advanced filters', () => {
      const store = useRBACStore.getState();
      store.setShowAdvancedFilters(true);

      const state = useRBACStore.getState();
      expect(state.showAdvancedFilters).toBe(true);
    });
  });

  describe('Rate Limit Overrides', () => {
    it('should fetch rate limit overrides successfully', async () => {
      const mockOverrides = [
        {
          id: '1',
          userId: 'user-1',
          userName: 'User Name',
          userEmail: 'user@example.com',
          endpoint: '/api/v1/stocks/*/price',
          method: 'GET',
          originalLimit: 100,
          requestedLimit: 1000,
          approvedLimit: 500,
          reason: 'High-frequency analysis',
          businessJustification: 'Critical trading algorithm testing',
          urgency: 'high' as const,
          status: 'approved' as const,
          expirationDate: '2024-02-01T00:00:00Z',
          submittedAt: '2024-01-01T10:00:00Z',
          reviewedAt: '2024-01-01T11:00:00Z',
          reviewedBy: 'admin-1',
          reviewerComment: 'Approved with reduced limit',
          autoRevokeAt: '2024-02-01T00:00:00Z',
          usageStats: {
            currentUsage: 250,
            peakUsage: 400,
            lastUsed: '2024-01-01T15:00:00Z'
          },
          metadata: { project: 'trading-bot-v2' }
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overrides: mockOverrides })
      });

      const store = useRBACStore.getState();
      await store.fetchRateLimitOverrides();

      const state = useRBACStore.getState();
      expect(state.rateLimitOverrides).toEqual(mockOverrides);
    });
  });
});