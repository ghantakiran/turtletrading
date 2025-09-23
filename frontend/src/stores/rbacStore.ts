/**
 * RBAC Store - Role-Based Access Control and Audit System
 *
 * Features:
 * - Role and permission management
 * - Audit trail tracking
 * - Rate limit overrides with approval workflow
 * - Resource access control
 * - Activity monitoring
 * - Compliance reporting
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

// Types
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  inherits: string[]; // Role IDs this role inherits from
  isSystem: boolean; // System roles cannot be deleted
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
  description: string;
}

export interface PermissionCondition {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'not_in' | 'gt' | 'lt' | 'contains';
  value: any;
}

export interface User {
  id: string;
  email: string;
  name: string;
  roles: string[]; // Role IDs
  permissions: Permission[]; // Direct permissions
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  outcome: 'success' | 'failure' | 'partial';
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  requestId: string;
  duration?: number;
  changes?: AuditChange[];
}

export interface AuditChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface RateLimitOverride {
  id: string;
  userId: string;
  resource: string;
  originalLimit: number;
  newLimit: number;
  duration: number; // Duration in seconds
  reason: string;
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'active';
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvalReason?: string;
  expiresAt: string;
  metadata: Record<string, any>;
}

export interface AccessRequest {
  id: string;
  userId: string;
  requestedRoles: string[];
  requestedPermissions: Permission[];
  reason: string;
  businessJustification: string;
  duration?: number; // Temporary access duration in seconds
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvalReason?: string;
  expiresAt?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResourceAccess {
  resource: string;
  actions: string[];
  lastAccessed: string;
  accessCount: number;
  restrictions: AccessRestriction[];
}

export interface AccessRestriction {
  type: 'time' | 'location' | 'device' | 'network';
  conditions: Record<string, any>;
  enabled: boolean;
}

export interface ComplianceReport {
  id: string;
  type: 'soc2' | 'gdpr' | 'hipaa' | 'pci' | 'custom';
  name: string;
  description: string;
  period: { from: string; to: string };
  status: 'generating' | 'completed' | 'failed';
  sections: ComplianceSection[];
  generatedAt?: string;
  generatedBy: string;
  filePath?: string;
}

export interface ComplianceSection {
  id: string;
  title: string;
  description: string;
  requirements: ComplianceRequirement[];
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
}

export interface ComplianceRequirement {
  id: string;
  title: string;
  description: string;
  status: 'met' | 'not_met' | 'partial' | 'not_applicable';
  evidence: string[];
  findings: string[];
  recommendations: string[];
}

// Store State
interface RBACState {
  // Roles and Permissions
  roles: Role[];
  permissions: Permission[];
  users: User[];
  rolesLoading: boolean;
  permissionsLoading: boolean;
  usersLoading: boolean;
  rbacError: string | null;

  // Audit Trail
  auditEntries: AuditEntry[];
  auditLoading: boolean;
  auditError: string | null;
  auditFilters: {
    userId?: string;
    resource?: string;
    action?: string;
    outcome?: string;
    dateRange: { from: string; to: string };
  };

  // Rate Limit Overrides
  rateLimitOverrides: RateLimitOverride[];
  overridesLoading: boolean;
  overridesError: string | null;

  // Access Requests
  accessRequests: AccessRequest[];
  requestsLoading: boolean;
  requestsError: string | null;

  // Resource Access
  resourceAccess: ResourceAccess[];
  accessLoading: boolean;
  accessError: string | null;

  // Compliance
  complianceReports: ComplianceReport[];
  complianceLoading: boolean;
  complianceError: string | null;

  // Current User Context
  currentUser: User | null;
  currentUserPermissions: Permission[];
  currentUserRoles: Role[];

  // UI State
  selectedUser: string | null;
  selectedRole: string | null;
  selectedAuditEntry: string | null;
}

// Store Actions
interface RBACActions {
  // Roles and Permissions
  fetchRoles: () => Promise<void>;
  fetchPermissions: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  createRole: (role: Omit<Role, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void>;
  updateRole: (id: string, updates: Partial<Role>) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;
  assignRoleToUser: (userId: string, roleId: string) => Promise<void>;
  removeRoleFromUser: (userId: string, roleId: string) => Promise<void>;
  grantPermissionToUser: (userId: string, permission: Permission) => Promise<void>;
  revokePermissionFromUser: (userId: string, permissionId: string) => Promise<void>;

  // Audit Trail
  fetchAuditEntries: (filters?: Partial<RBACState['auditFilters']>) => Promise<void>;
  setAuditFilters: (filters: Partial<RBACState['auditFilters']>) => void;
  exportAuditLog: (filters: RBACState['auditFilters'], format: 'csv' | 'json' | 'pdf') => Promise<void>;

  // Rate Limit Overrides
  fetchRateLimitOverrides: () => Promise<void>;
  requestRateLimitOverride: (override: Omit<RateLimitOverride, 'id' | 'status' | 'requestedAt'>) => Promise<void>;
  approveRateLimitOverride: (id: string, reason: string) => Promise<void>;
  denyRateLimitOverride: (id: string, reason: string) => Promise<void>;
  revokeRateLimitOverride: (id: string) => Promise<void>;

  // Access Requests
  fetchAccessRequests: () => Promise<void>;
  createAccessRequest: (request: Omit<AccessRequest, 'id' | 'status' | 'requestedAt'>) => Promise<void>;
  approveAccessRequest: (id: string, reason: string) => Promise<void>;
  denyAccessRequest: (id: string, reason: string) => Promise<void>;

  // Resource Access
  fetchResourceAccess: (userId?: string) => Promise<void>;
  checkPermission: (resource: string, action: string, context?: Record<string, any>) => boolean;
  logResourceAccess: (resource: string, action: string) => Promise<void>;

  // Compliance
  fetchComplianceReports: () => Promise<void>;
  generateComplianceReport: (type: ComplianceReport['type'], period: { from: string; to: string }) => Promise<void>;
  downloadComplianceReport: (id: string) => Promise<void>;

  // User Context
  setCurrentUser: (user: User) => void;
  refreshCurrentUserPermissions: () => Promise<void>;

  // UI Actions
  setSelectedUser: (userId: string | null) => void;
  setSelectedRole: (roleId: string | null) => void;
  setSelectedAuditEntry: (entryId: string | null) => void;
}

// Permission checking utility
const hasPermission = (userPermissions: Permission[], resource: string, action: string, context?: Record<string, any>): boolean => {
  return userPermissions.some(permission => {
    if (permission.resource !== resource || permission.action !== action) {
      return false;
    }

    // Check conditions if they exist
    if (permission.conditions && context) {
      return permission.conditions.every(condition => {
        const contextValue = context[condition.field];
        switch (condition.operator) {
          case 'eq':
            return contextValue === condition.value;
          case 'ne':
            return contextValue !== condition.value;
          case 'in':
            return Array.isArray(condition.value) && condition.value.includes(contextValue);
          case 'not_in':
            return Array.isArray(condition.value) && !condition.value.includes(contextValue);
          case 'gt':
            return contextValue > condition.value;
          case 'lt':
            return contextValue < condition.value;
          case 'contains':
            return typeof contextValue === 'string' && contextValue.includes(condition.value);
          default:
            return false;
        }
      });
    }

    return true;
  });
};

// Create the store
export const useRBACStore = create<RBACState & RBACActions>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial State
        roles: [],
        permissions: [],
        users: [],
        rolesLoading: false,
        permissionsLoading: false,
        usersLoading: false,
        rbacError: null,

        auditEntries: [],
        auditLoading: false,
        auditError: null,
        auditFilters: {
          dateRange: { from: 'now-7d', to: 'now' },
        },

        rateLimitOverrides: [],
        overridesLoading: false,
        overridesError: null,

        accessRequests: [],
        requestsLoading: false,
        requestsError: null,

        resourceAccess: [],
        accessLoading: false,
        accessError: null,

        complianceReports: [],
        complianceLoading: false,
        complianceError: null,

        currentUser: null,
        currentUserPermissions: [],
        currentUserRoles: [],

        selectedUser: null,
        selectedRole: null,
        selectedAuditEntry: null,

        // Roles and Permissions Actions
        fetchRoles: async () => {
          set({ rolesLoading: true, rbacError: null });
          try {
            const response = await fetch('/api/v1/admin/rbac/roles');
            if (!response.ok) throw new Error('Failed to fetch roles');
            const roles = await response.json();
            set({ roles, rolesLoading: false });
          } catch (error) {
            set({
              rbacError: error instanceof Error ? error.message : 'Unknown error',
              rolesLoading: false
            });
          }
        },

        fetchPermissions: async () => {
          set({ permissionsLoading: true, rbacError: null });
          try {
            const response = await fetch('/api/v1/admin/rbac/permissions');
            if (!response.ok) throw new Error('Failed to fetch permissions');
            const permissions = await response.json();
            set({ permissions, permissionsLoading: false });
          } catch (error) {
            set({
              rbacError: error instanceof Error ? error.message : 'Unknown error',
              permissionsLoading: false
            });
          }
        },

        fetchUsers: async () => {
          set({ usersLoading: true, rbacError: null });
          try {
            const response = await fetch('/api/v1/admin/rbac/users');
            if (!response.ok) throw new Error('Failed to fetch users');
            const users = await response.json();
            set({ users, usersLoading: false });
          } catch (error) {
            set({
              rbacError: error instanceof Error ? error.message : 'Unknown error',
              usersLoading: false
            });
          }
        },

        createRole: async (roleData) => {
          try {
            const response = await fetch('/api/v1/admin/rbac/roles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(roleData),
            });
            if (!response.ok) throw new Error('Failed to create role');

            const newRole = await response.json();
            set(state => ({
              roles: [...state.roles, newRole]
            }));
          } catch (error) {
            set({ rbacError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        updateRole: async (id: string, updates: Partial<Role>) => {
          try {
            const response = await fetch(`/api/v1/admin/rbac/roles/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            });
            if (!response.ok) throw new Error('Failed to update role');

            const updatedRole = await response.json();
            set(state => ({
              roles: state.roles.map(role => role.id === id ? updatedRole : role)
            }));
          } catch (error) {
            set({ rbacError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        deleteRole: async (id: string) => {
          try {
            const response = await fetch(`/api/v1/admin/rbac/roles/${id}`, {
              method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete role');

            set(state => ({
              roles: state.roles.filter(role => role.id !== id)
            }));
          } catch (error) {
            set({ rbacError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        assignRoleToUser: async (userId: string, roleId: string) => {
          try {
            const response = await fetch(`/api/v1/admin/rbac/users/${userId}/roles`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roleId }),
            });
            if (!response.ok) throw new Error('Failed to assign role');

            const updatedUser = await response.json();
            set(state => ({
              users: state.users.map(user => user.id === userId ? updatedUser : user)
            }));
          } catch (error) {
            set({ rbacError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        removeRoleFromUser: async (userId: string, roleId: string) => {
          try {
            const response = await fetch(`/api/v1/admin/rbac/users/${userId}/roles/${roleId}`, {
              method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to remove role');

            const updatedUser = await response.json();
            set(state => ({
              users: state.users.map(user => user.id === userId ? updatedUser : user)
            }));
          } catch (error) {
            set({ rbacError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        grantPermissionToUser: async (userId: string, permission: Permission) => {
          try {
            const response = await fetch(`/api/v1/admin/rbac/users/${userId}/permissions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(permission),
            });
            if (!response.ok) throw new Error('Failed to grant permission');

            const updatedUser = await response.json();
            set(state => ({
              users: state.users.map(user => user.id === userId ? updatedUser : user)
            }));
          } catch (error) {
            set({ rbacError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        revokePermissionFromUser: async (userId: string, permissionId: string) => {
          try {
            const response = await fetch(`/api/v1/admin/rbac/users/${userId}/permissions/${permissionId}`, {
              method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to revoke permission');

            const updatedUser = await response.json();
            set(state => ({
              users: state.users.map(user => user.id === userId ? updatedUser : user)
            }));
          } catch (error) {
            set({ rbacError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        // Audit Trail Actions
        fetchAuditEntries: async (filters?: Partial<RBACState['auditFilters']>) => {
          set({ auditLoading: true, auditError: null });
          try {
            const currentFilters = get().auditFilters;
            const mergedFilters = { ...currentFilters, ...filters };

            const params = new URLSearchParams();
            if (mergedFilters.userId) params.append('userId', mergedFilters.userId);
            if (mergedFilters.resource) params.append('resource', mergedFilters.resource);
            if (mergedFilters.action) params.append('action', mergedFilters.action);
            if (mergedFilters.outcome) params.append('outcome', mergedFilters.outcome);
            params.append('from', mergedFilters.dateRange.from);
            params.append('to', mergedFilters.dateRange.to);

            const response = await fetch(`/api/v1/admin/rbac/audit?${params}`);
            if (!response.ok) throw new Error('Failed to fetch audit entries');
            const auditEntries = await response.json();
            set({ auditEntries, auditLoading: false });
          } catch (error) {
            set({
              auditError: error instanceof Error ? error.message : 'Unknown error',
              auditLoading: false
            });
          }
        },

        setAuditFilters: (filters: Partial<RBACState['auditFilters']>) => {
          set(state => ({
            auditFilters: { ...state.auditFilters, ...filters }
          }));
        },

        exportAuditLog: async (filters: RBACState['auditFilters'], format: 'csv' | 'json' | 'pdf') => {
          try {
            const response = await fetch('/api/v1/admin/rbac/audit/export', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filters, format }),
            });
            if (!response.ok) throw new Error('Failed to export audit log');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-log.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          } catch (error) {
            set({ auditError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        // Rate Limit Override Actions
        fetchRateLimitOverrides: async () => {
          set({ overridesLoading: true, overridesError: null });
          try {
            const response = await fetch('/api/v1/admin/rbac/rate-limit-overrides');
            if (!response.ok) throw new Error('Failed to fetch rate limit overrides');
            const overrides = await response.json();
            set({ rateLimitOverrides: overrides, overridesLoading: false });
          } catch (error) {
            set({
              overridesError: error instanceof Error ? error.message : 'Unknown error',
              overridesLoading: false
            });
          }
        },

        requestRateLimitOverride: async (overrideData) => {
          try {
            const response = await fetch('/api/v1/admin/rbac/rate-limit-overrides', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(overrideData),
            });
            if (!response.ok) throw new Error('Failed to request rate limit override');

            const newOverride = await response.json();
            set(state => ({
              rateLimitOverrides: [...state.rateLimitOverrides, newOverride]
            }));
          } catch (error) {
            set({ overridesError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        approveRateLimitOverride: async (id: string, reason: string) => {
          try {
            const response = await fetch(`/api/v1/admin/rbac/rate-limit-overrides/${id}/approve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason }),
            });
            if (!response.ok) throw new Error('Failed to approve override');

            const updatedOverride = await response.json();
            set(state => ({
              rateLimitOverrides: state.rateLimitOverrides.map(override =>
                override.id === id ? updatedOverride : override
              )
            }));
          } catch (error) {
            set({ overridesError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        denyRateLimitOverride: async (id: string, reason: string) => {
          try {
            const response = await fetch(`/api/v1/admin/rbac/rate-limit-overrides/${id}/deny`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason }),
            });
            if (!response.ok) throw new Error('Failed to deny override');

            const updatedOverride = await response.json();
            set(state => ({
              rateLimitOverrides: state.rateLimitOverrides.map(override =>
                override.id === id ? updatedOverride : override
              )
            }));
          } catch (error) {
            set({ overridesError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        revokeRateLimitOverride: async (id: string) => {
          try {
            const response = await fetch(`/api/v1/admin/rbac/rate-limit-overrides/${id}/revoke`, {
              method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to revoke override');

            const updatedOverride = await response.json();
            set(state => ({
              rateLimitOverrides: state.rateLimitOverrides.map(override =>
                override.id === id ? updatedOverride : override
              )
            }));
          } catch (error) {
            set({ overridesError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        // Access Request Actions
        fetchAccessRequests: async () => {
          set({ requestsLoading: true, requestsError: null });
          try {
            const response = await fetch('/api/v1/admin/rbac/access-requests');
            if (!response.ok) throw new Error('Failed to fetch access requests');
            const requests = await response.json();
            set({ accessRequests: requests, requestsLoading: false });
          } catch (error) {
            set({
              requestsError: error instanceof Error ? error.message : 'Unknown error',
              requestsLoading: false
            });
          }
        },

        createAccessRequest: async (requestData) => {
          try {
            const response = await fetch('/api/v1/admin/rbac/access-requests', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestData),
            });
            if (!response.ok) throw new Error('Failed to create access request');

            const newRequest = await response.json();
            set(state => ({
              accessRequests: [...state.accessRequests, newRequest]
            }));
          } catch (error) {
            set({ requestsError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        approveAccessRequest: async (id: string, reason: string) => {
          try {
            const response = await fetch(`/api/v1/admin/rbac/access-requests/${id}/approve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason }),
            });
            if (!response.ok) throw new Error('Failed to approve access request');

            const updatedRequest = await response.json();
            set(state => ({
              accessRequests: state.accessRequests.map(request =>
                request.id === id ? updatedRequest : request
              )
            }));
          } catch (error) {
            set({ requestsError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        denyAccessRequest: async (id: string, reason: string) => {
          try {
            const response = await fetch(`/api/v1/admin/rbac/access-requests/${id}/deny`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason }),
            });
            if (!response.ok) throw new Error('Failed to deny access request');

            const updatedRequest = await response.json();
            set(state => ({
              accessRequests: state.accessRequests.map(request =>
                request.id === id ? updatedRequest : request
              )
            }));
          } catch (error) {
            set({ requestsError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        // Resource Access Actions
        fetchResourceAccess: async (userId?: string) => {
          set({ accessLoading: true, accessError: null });
          try {
            const params = new URLSearchParams();
            if (userId) params.append('userId', userId);

            const response = await fetch(`/api/v1/admin/rbac/resource-access?${params}`);
            if (!response.ok) throw new Error('Failed to fetch resource access');
            const access = await response.json();
            set({ resourceAccess: access, accessLoading: false });
          } catch (error) {
            set({
              accessError: error instanceof Error ? error.message : 'Unknown error',
              accessLoading: false
            });
          }
        },

        checkPermission: (resource: string, action: string, context?: Record<string, any>) => {
          const { currentUserPermissions } = get();
          return hasPermission(currentUserPermissions, resource, action, context);
        },

        logResourceAccess: async (resource: string, action: string) => {
          try {
            await fetch('/api/v1/admin/rbac/resource-access/log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ resource, action }),
            });
          } catch (error) {
            console.error('Failed to log resource access:', error);
          }
        },

        // Compliance Actions
        fetchComplianceReports: async () => {
          set({ complianceLoading: true, complianceError: null });
          try {
            const response = await fetch('/api/v1/admin/rbac/compliance-reports');
            if (!response.ok) throw new Error('Failed to fetch compliance reports');
            const reports = await response.json();
            set({ complianceReports: reports, complianceLoading: false });
          } catch (error) {
            set({
              complianceError: error instanceof Error ? error.message : 'Unknown error',
              complianceLoading: false
            });
          }
        },

        generateComplianceReport: async (type: ComplianceReport['type'], period: { from: string; to: string }) => {
          try {
            const response = await fetch('/api/v1/admin/rbac/compliance-reports', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type, period }),
            });
            if (!response.ok) throw new Error('Failed to generate compliance report');

            const newReport = await response.json();
            set(state => ({
              complianceReports: [...state.complianceReports, newReport]
            }));
          } catch (error) {
            set({ complianceError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        downloadComplianceReport: async (id: string) => {
          try {
            const response = await fetch(`/api/v1/admin/rbac/compliance-reports/${id}/download`);
            if (!response.ok) throw new Error('Failed to download report');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `compliance-report-${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          } catch (error) {
            set({ complianceError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        // User Context Actions
        setCurrentUser: (user: User) => {
          const { roles } = get();
          const userRoles = roles.filter(role => user.roles.includes(role.id));

          // Collect all permissions from roles and direct permissions
          const allPermissions = [
            ...user.permissions,
            ...userRoles.flatMap(role => role.permissions)
          ];

          // Remove duplicates
          const uniquePermissions = allPermissions.filter((permission, index, array) =>
            array.findIndex(p => p.id === permission.id) === index
          );

          set({
            currentUser: user,
            currentUserRoles: userRoles,
            currentUserPermissions: uniquePermissions
          });
        },

        refreshCurrentUserPermissions: async () => {
          const { currentUser } = get();
          if (!currentUser) return;

          try {
            const response = await fetch(`/api/v1/admin/rbac/users/${currentUser.id}/permissions`);
            if (!response.ok) throw new Error('Failed to refresh permissions');
            const permissions = await response.json();
            set({ currentUserPermissions: permissions });
          } catch (error) {
            set({ rbacError: error instanceof Error ? error.message : 'Unknown error' });
          }
        },

        // UI Actions
        setSelectedUser: (userId: string | null) => set({ selectedUser: userId }),
        setSelectedRole: (roleId: string | null) => set({ selectedRole: roleId }),
        setSelectedAuditEntry: (entryId: string | null) => set({ selectedAuditEntry: entryId }),
      }),
      {
        name: 'turtle-rbac-store',
        partialize: (state) => ({
          auditFilters: state.auditFilters,
          selectedUser: state.selectedUser,
          selectedRole: state.selectedRole,
        }),
      }
    )
  )
);

// Computed selectors
export const useRBACSelectors = () => ({
  // Role selectors
  systemRoles: useRBACStore(state =>
    state.roles.filter(role => role.isSystem)
  ),

  customRoles: useRBACStore(state =>
    state.roles.filter(role => !role.isSystem)
  ),

  // User selectors
  activeUsers: useRBACStore(state =>
    state.users.filter(user => user.isActive)
  ),

  usersWithRole: (roleId: string) => useRBACStore(state =>
    state.users.filter(user => user.roles.includes(roleId))
  ),

  // Audit selectors
  recentAuditEntries: useRBACStore(state =>
    state.auditEntries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50)
  ),

  failedActions: useRBACStore(state =>
    state.auditEntries.filter(entry => entry.outcome === 'failure')
  ),

  // Override selectors
  pendingOverrides: useRBACStore(state =>
    state.rateLimitOverrides.filter(override => override.status === 'pending')
  ),

  activeOverrides: useRBACStore(state =>
    state.rateLimitOverrides.filter(override => override.status === 'active')
  ),

  // Request selectors
  pendingAccessRequests: useRBACStore(state =>
    state.accessRequests.filter(request => request.status === 'pending')
  ),

  urgentAccessRequests: useRBACStore(state =>
    state.accessRequests.filter(request =>
      request.status === 'pending' && (request.urgency === 'high' || request.urgency === 'critical')
    )
  ),

  // Compliance selectors
  recentComplianceReports: useRBACStore(state =>
    state.complianceReports
      .sort((a, b) => new Date(b.generatedAt || '').getTime() - new Date(a.generatedAt || '').getTime())
      .slice(0, 10)
  ),

  pendingComplianceReports: useRBACStore(state =>
    state.complianceReports.filter(report => report.status === 'generating')
  ),
});