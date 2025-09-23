/**
 * Widget Sandbox System
 * Advanced sandboxing and security policies for widget execution
 */

import { WidgetPermission } from '../sdk/WidgetSDK';

export interface SandboxPolicy {
  id: string;
  name: string;
  description: string;
  allowedFeatures: string[];
  blockedFeatures: string[];
  cspDirectives: Record<string, string[]>;
  resourceLimits: ResourceLimits;
  networkPolicy: NetworkPolicy;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCPUPercent: number;
  maxNetworkRequestsPerMinute: number;
  maxStorageMB: number;
  maxExecutionTimeMs: number;
}

export interface NetworkPolicy {
  allowedDomains: string[];
  blockedDomains: string[];
  allowedPorts: number[];
  requireHTTPS: boolean;
  allowWebSockets: boolean;
  allowEventSource: boolean;
}

export interface SandboxViolation {
  id: string;
  instanceId: string;
  type: 'RESOURCE_LIMIT' | 'NETWORK_POLICY' | 'CSP_VIOLATION' | 'PERMISSION_DENIED';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: number;
  metadata: Record<string, any>;
}

export class WidgetSandbox {
  private policies: Map<string, SandboxPolicy> = new Map();
  private violations: SandboxViolation[] = [];
  private resourceMonitors: Map<string, ResourceMonitor> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
    this.setupViolationDetection();
  }

  /**
   * Create sandbox policy based on widget permissions
   */
  public createSandboxPolicy(
    permissions: WidgetPermission[],
    trustLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
  ): SandboxPolicy {
    const policyId = `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const policy: SandboxPolicy = {
      id: policyId,
      name: `Widget Policy - ${trustLevel}`,
      description: `Sandbox policy for widget with ${permissions.length} permissions`,
      allowedFeatures: this.generateAllowedFeatures(permissions),
      blockedFeatures: this.generateBlockedFeatures(permissions, trustLevel),
      cspDirectives: this.generateCSPDirectives(permissions, trustLevel),
      resourceLimits: this.generateResourceLimits(trustLevel),
      networkPolicy: this.generateNetworkPolicy(permissions, trustLevel)
    };

    this.policies.set(policyId, policy);
    return policy;
  }

  /**
   * Generate Content Security Policy directives
   */
  public generateCSPDirectives(
    permissions: WidgetPermission[],
    trustLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  ): Record<string, string[]> {
    const csp: Record<string, string[]> = {
      'default-src': ["'none'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", "data:", "blob:"],
      'font-src': ["'self'", "data:"],
      'connect-src': ["'self'"],
      'media-src': ["'none'"],
      'object-src': ["'none'"],
      'child-src': ["'none'"],
      'frame-src': ["'none'"],
      'worker-src': ["'none'"],
      'manifest-src': ["'none'"],
      'base-uri': ["'none'"],
      'form-action': ["'none'"]
    };

    // Adjust CSP based on permissions
    if (permissions.includes(WidgetPermission.NETWORK_ACCESS)) {
      csp['connect-src'] = ["'self'", "https:", "wss:"];

      if (trustLevel === 'HIGH') {
        csp['connect-src'].push("*");
      }
    }

    if (permissions.includes(WidgetPermission.EXTERNAL_CONTENT)) {
      csp['img-src'].push("https:");
      csp['media-src'] = ["'self'", "https:"];
    }

    if (permissions.includes(WidgetPermission.FORMS)) {
      csp['form-action'] = ["'self'"];
    }

    if (permissions.includes(WidgetPermission.STORAGE)) {
      // Storage doesn't affect CSP directly but enables localStorage/sessionStorage
    }

    // Trust level adjustments
    if (trustLevel === 'LOW') {
      csp['script-src'] = ["'self'"]; // Remove unsafe-inline
      csp['connect-src'] = ["'self'"]; // Restrict network access
    }

    return csp;
  }

  /**
   * Generate sandbox iframe attributes
   */
  public generateSandboxAttributes(policy: SandboxPolicy): string {
    const attributes = ['allow-scripts'];

    // Add attributes based on allowed features
    if (policy.allowedFeatures.includes('forms')) {
      attributes.push('allow-forms');
    }

    if (policy.allowedFeatures.includes('popups')) {
      attributes.push('allow-popups');
    }

    if (policy.allowedFeatures.includes('downloads')) {
      attributes.push('allow-downloads');
    }

    if (policy.allowedFeatures.includes('same-origin')) {
      attributes.push('allow-same-origin');
    }

    if (policy.allowedFeatures.includes('pointer-lock')) {
      attributes.push('allow-pointer-lock');
    }

    if (policy.allowedFeatures.includes('presentation')) {
      attributes.push('allow-presentation');
    }

    return attributes.join(' ');
  }

  /**
   * Generate CSP header string
   */
  public generateCSPHeader(policy: SandboxPolicy): string {
    return Object.entries(policy.cspDirectives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  }

  /**
   * Validate widget execution against policy
   */
  public validateExecution(
    instanceId: string,
    action: string,
    metadata: Record<string, any>
  ): boolean {
    const monitor = this.resourceMonitors.get(instanceId);
    if (!monitor) return false;

    const policy = this.policies.get(monitor.policyId);
    if (!policy) return false;

    return this.checkAction(instanceId, action, metadata, policy);
  }

  /**
   * Start monitoring widget resource usage
   */
  public startMonitoring(instanceId: string, policyId: string): void {
    const policy = this.policies.get(policyId);
    if (!policy) return;

    const monitor: ResourceMonitor = {
      instanceId,
      policyId,
      startTime: Date.now(),
      resourceUsage: {
        memory: 0,
        cpu: 0,
        networkRequests: 0,
        storage: 0
      },
      violations: []
    };

    this.resourceMonitors.set(instanceId, monitor);

    // Start periodic monitoring
    const interval = setInterval(() => {
      this.updateResourceUsage(instanceId);
      this.checkResourceLimits(instanceId);
    }, 1000);

    monitor.monitoringInterval = interval;
  }

  /**
   * Stop monitoring widget
   */
  public stopMonitoring(instanceId: string): void {
    const monitor = this.resourceMonitors.get(instanceId);
    if (monitor?.monitoringInterval) {
      clearInterval(monitor.monitoringInterval);
    }
    this.resourceMonitors.delete(instanceId);
  }

  /**
   * Get sandbox violations
   */
  public getViolations(instanceId?: string): SandboxViolation[] {
    if (instanceId) {
      return this.violations.filter(v => v.instanceId === instanceId);
    }
    return [...this.violations];
  }

  /**
   * Report sandbox violation
   */
  public reportViolation(violation: Omit<SandboxViolation, 'id' | 'timestamp'>): void {
    const fullViolation: SandboxViolation = {
      ...violation,
      id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    this.violations.push(fullViolation);

    // Keep only recent violations (last 1000)
    if (this.violations.length > 1000) {
      this.violations.splice(0, this.violations.length - 1000);
    }

    // Emit violation event
    this.emitViolation(fullViolation);
  }

  /**
   * Initialize default sandbox policies
   */
  private initializeDefaultPolicies(): void {
    // Restrictive policy for untrusted widgets
    this.policies.set('restrictive', {
      id: 'restrictive',
      name: 'Restrictive Policy',
      description: 'Maximum security for untrusted widgets',
      allowedFeatures: ['scripts'],
      blockedFeatures: ['forms', 'popups', 'downloads', 'same-origin', 'network'],
      cspDirectives: this.generateCSPDirectives([], 'LOW'),
      resourceLimits: {
        maxMemoryMB: 16,
        maxCPUPercent: 10,
        maxNetworkRequestsPerMinute: 0,
        maxStorageMB: 1,
        maxExecutionTimeMs: 30000
      },
      networkPolicy: {
        allowedDomains: [],
        blockedDomains: ['*'],
        allowedPorts: [],
        requireHTTPS: true,
        allowWebSockets: false,
        allowEventSource: false
      }
    });

    // Standard policy for verified widgets
    this.policies.set('standard', {
      id: 'standard',
      name: 'Standard Policy',
      description: 'Balanced security for verified widgets',
      allowedFeatures: ['scripts', 'forms', 'network'],
      blockedFeatures: ['popups', 'downloads'],
      cspDirectives: this.generateCSPDirectives([
        WidgetPermission.NETWORK_ACCESS,
        WidgetPermission.FORMS
      ], 'MEDIUM'),
      resourceLimits: {
        maxMemoryMB: 64,
        maxCPUPercent: 25,
        maxNetworkRequestsPerMinute: 60,
        maxStorageMB: 5,
        maxExecutionTimeMs: 60000
      },
      networkPolicy: {
        allowedDomains: ['api.turtletrading.com', 'cdn.turtletrading.com'],
        blockedDomains: [],
        allowedPorts: [443, 80],
        requireHTTPS: true,
        allowWebSockets: true,
        allowEventSource: true
      }
    });

    // Trusted policy for internal widgets
    this.policies.set('trusted', {
      id: 'trusted',
      name: 'Trusted Policy',
      description: 'High permissions for trusted internal widgets',
      allowedFeatures: ['scripts', 'forms', 'network', 'storage', 'popups'],
      blockedFeatures: ['downloads'],
      cspDirectives: this.generateCSPDirectives([
        WidgetPermission.NETWORK_ACCESS,
        WidgetPermission.FORMS,
        WidgetPermission.STORAGE,
        WidgetPermission.POPUPS
      ], 'HIGH'),
      resourceLimits: {
        maxMemoryMB: 256,
        maxCPUPercent: 50,
        maxNetworkRequestsPerMinute: 300,
        maxStorageMB: 50,
        maxExecutionTimeMs: 300000
      },
      networkPolicy: {
        allowedDomains: ['*'],
        blockedDomains: [],
        allowedPorts: [443, 80, 8080, 3000],
        requireHTTPS: false,
        allowWebSockets: true,
        allowEventSource: true
      }
    });
  }

  /**
   * Generate allowed features based on permissions
   */
  private generateAllowedFeatures(permissions: WidgetPermission[]): string[] {
    const features = ['scripts']; // Always allow scripts

    if (permissions.includes(WidgetPermission.FORMS)) {
      features.push('forms');
    }

    if (permissions.includes(WidgetPermission.POPUPS)) {
      features.push('popups');
    }

    if (permissions.includes(WidgetPermission.DOWNLOADS)) {
      features.push('downloads');
    }

    if (permissions.includes(WidgetPermission.NETWORK_ACCESS)) {
      features.push('network', 'same-origin');
    }

    if (permissions.includes(WidgetPermission.STORAGE)) {
      features.push('storage');
    }

    return features;
  }

  /**
   * Generate blocked features based on trust level
   */
  private generateBlockedFeatures(
    permissions: WidgetPermission[],
    trustLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  ): string[] {
    const allFeatures = [
      'forms', 'popups', 'downloads', 'network', 'storage',
      'geolocation', 'camera', 'microphone', 'fullscreen'
    ];

    const allowedFeatures = this.generateAllowedFeatures(permissions);

    let blockedFeatures = allFeatures.filter(feature => !allowedFeatures.includes(feature));

    // Additional restrictions based on trust level
    if (trustLevel === 'LOW') {
      blockedFeatures.push('same-origin', 'popups', 'downloads');
    }

    return [...new Set(blockedFeatures)]; // Remove duplicates
  }

  /**
   * Generate resource limits based on trust level
   */
  private generateResourceLimits(trustLevel: 'LOW' | 'MEDIUM' | 'HIGH'): ResourceLimits {
    const limits: Record<string, ResourceLimits> = {
      LOW: {
        maxMemoryMB: 32,
        maxCPUPercent: 15,
        maxNetworkRequestsPerMinute: 30,
        maxStorageMB: 2,
        maxExecutionTimeMs: 45000
      },
      MEDIUM: {
        maxMemoryMB: 128,
        maxCPUPercent: 35,
        maxNetworkRequestsPerMinute: 120,
        maxStorageMB: 10,
        maxExecutionTimeMs: 120000
      },
      HIGH: {
        maxMemoryMB: 512,
        maxCPUPercent: 60,
        maxNetworkRequestsPerMinute: 600,
        maxStorageMB: 100,
        maxExecutionTimeMs: 600000
      }
    };

    return limits[trustLevel];
  }

  /**
   * Generate network policy based on permissions and trust level
   */
  private generateNetworkPolicy(
    permissions: WidgetPermission[],
    trustLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  ): NetworkPolicy {
    const hasNetworkAccess = permissions.includes(WidgetPermission.NETWORK_ACCESS);

    if (!hasNetworkAccess) {
      return {
        allowedDomains: [],
        blockedDomains: ['*'],
        allowedPorts: [],
        requireHTTPS: true,
        allowWebSockets: false,
        allowEventSource: false
      };
    }

    const policies: Record<string, NetworkPolicy> = {
      LOW: {
        allowedDomains: ['api.turtletrading.com'],
        blockedDomains: [],
        allowedPorts: [443],
        requireHTTPS: true,
        allowWebSockets: false,
        allowEventSource: false
      },
      MEDIUM: {
        allowedDomains: ['*.turtletrading.com', 'api.yahoo.com', 'api.alphavantage.co'],
        blockedDomains: [],
        allowedPorts: [443, 80],
        requireHTTPS: true,
        allowWebSockets: true,
        allowEventSource: true
      },
      HIGH: {
        allowedDomains: ['*'],
        blockedDomains: [],
        allowedPorts: [443, 80, 8080, 3000],
        requireHTTPS: false,
        allowWebSockets: true,
        allowEventSource: true
      }
    };

    return policies[trustLevel];
  }

  /**
   * Check if action is allowed by policy
   */
  private checkAction(
    instanceId: string,
    action: string,
    metadata: Record<string, any>,
    policy: SandboxPolicy
  ): boolean {
    switch (action) {
      case 'network_request':
        return this.checkNetworkRequest(instanceId, metadata, policy);
      case 'storage_access':
        return this.checkStorageAccess(instanceId, metadata, policy);
      case 'popup_request':
        return policy.allowedFeatures.includes('popups');
      case 'form_submission':
        return policy.allowedFeatures.includes('forms');
      default:
        return true; // Allow unknown actions by default
    }
  }

  /**
   * Check network request against policy
   */
  private checkNetworkRequest(
    instanceId: string,
    metadata: Record<string, any>,
    policy: SandboxPolicy
  ): boolean {
    const { url, method } = metadata;
    const urlObj = new URL(url);

    // Check allowed domains
    const isAllowedDomain = policy.networkPolicy.allowedDomains.some(domain => {
      if (domain === '*') return true;
      if (domain.startsWith('*.')) {
        return urlObj.hostname.endsWith(domain.slice(2));
      }
      return urlObj.hostname === domain;
    });

    if (!isAllowedDomain) {
      this.reportViolation({
        instanceId,
        type: 'NETWORK_POLICY',
        description: `Network request to disallowed domain: ${urlObj.hostname}`,
        severity: 'MEDIUM',
        metadata: { url, method }
      });
      return false;
    }

    // Check HTTPS requirement
    if (policy.networkPolicy.requireHTTPS && urlObj.protocol !== 'https:') {
      this.reportViolation({
        instanceId,
        type: 'NETWORK_POLICY',
        description: `HTTP request blocked, HTTPS required: ${url}`,
        severity: 'HIGH',
        metadata: { url, method }
      });
      return false;
    }

    return true;
  }

  /**
   * Check storage access against policy
   */
  private checkStorageAccess(
    instanceId: string,
    metadata: Record<string, any>,
    policy: SandboxPolicy
  ): boolean {
    if (!policy.allowedFeatures.includes('storage')) {
      this.reportViolation({
        instanceId,
        type: 'PERMISSION_DENIED',
        description: 'Storage access denied by policy',
        severity: 'MEDIUM',
        metadata
      });
      return false;
    }

    return true;
  }

  /**
   * Update resource usage for widget
   */
  private updateResourceUsage(instanceId: string): void {
    const monitor = this.resourceMonitors.get(instanceId);
    if (!monitor) return;

    // This is a simplified implementation
    // In production, you'd use performance.measureUserAgentSpecificMemory()
    // or similar APIs where available
    monitor.resourceUsage.memory = (performance as any).memory?.usedJSHeapSize || 0;
    monitor.resourceUsage.cpu = Math.random() * 20; // Placeholder
  }

  /**
   * Check resource limits
   */
  private checkResourceLimits(instanceId: string): void {
    const monitor = this.resourceMonitors.get(instanceId);
    if (!monitor) return;

    const policy = this.policies.get(monitor.policyId);
    if (!policy) return;

    const { resourceUsage } = monitor;
    const { resourceLimits } = policy;

    // Check memory limit
    const memoryMB = resourceUsage.memory / (1024 * 1024);
    if (memoryMB > resourceLimits.maxMemoryMB) {
      this.reportViolation({
        instanceId,
        type: 'RESOURCE_LIMIT',
        description: `Memory limit exceeded: ${memoryMB.toFixed(2)}MB > ${resourceLimits.maxMemoryMB}MB`,
        severity: 'HIGH',
        metadata: { memoryMB, limit: resourceLimits.maxMemoryMB }
      });
    }

    // Check CPU limit
    if (resourceUsage.cpu > resourceLimits.maxCPUPercent) {
      this.reportViolation({
        instanceId,
        type: 'RESOURCE_LIMIT',
        description: `CPU limit exceeded: ${resourceUsage.cpu.toFixed(2)}% > ${resourceLimits.maxCPUPercent}%`,
        severity: 'MEDIUM',
        metadata: { cpuPercent: resourceUsage.cpu, limit: resourceLimits.maxCPUPercent }
      });
    }

    // Check execution time
    const executionTime = Date.now() - monitor.startTime;
    if (executionTime > resourceLimits.maxExecutionTimeMs) {
      this.reportViolation({
        instanceId,
        type: 'RESOURCE_LIMIT',
        description: `Execution time limit exceeded: ${executionTime}ms > ${resourceLimits.maxExecutionTimeMs}ms`,
        severity: 'CRITICAL',
        metadata: { executionTime, limit: resourceLimits.maxExecutionTimeMs }
      });
    }
  }

  /**
   * Setup violation detection
   */
  private setupViolationDetection(): void {
    // Listen for CSP violations
    document.addEventListener('securitypolicyviolation', (event) => {
      this.reportViolation({
        instanceId: 'unknown', // Would need to map from source
        type: 'CSP_VIOLATION',
        description: `CSP violation: ${event.violatedDirective}`,
        severity: 'HIGH',
        metadata: {
          directive: event.violatedDirective,
          blockedURI: event.blockedURI,
          lineNumber: event.lineNumber,
          sourceFile: event.sourceFile
        }
      });
    });
  }

  /**
   * Emit violation event
   */
  private emitViolation(violation: SandboxViolation): void {
    // Emit custom event for violation handling
    window.dispatchEvent(new CustomEvent('widget-sandbox-violation', {
      detail: violation
    }));
  }
}

interface ResourceMonitor {
  instanceId: string;
  policyId: string;
  startTime: number;
  resourceUsage: {
    memory: number;
    cpu: number;
    networkRequests: number;
    storage: number;
  };
  violations: string[];
  monitoringInterval?: number;
}

export default WidgetSandbox;