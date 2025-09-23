/**
 * Widget Runtime System - Main Exports
 * Secure widget execution environment with sandboxing and communication
 */

// Core Runtime
export { default as WidgetRuntime } from './WidgetRuntime';
export type {
  RuntimeConfig,
  WidgetMessage,
  WidgetSecurityContext,
  RuntimeEnvironment
} from './WidgetRuntime';

// Sandboxing System
export { default as WidgetSandbox } from './WidgetSandbox';
export type {
  SandboxPolicy,
  ResourceLimits,
  NetworkPolicy,
  SandboxViolation
} from './WidgetSandbox';

// Communication Bridge
export { default as PostMessageBridge } from './PostMessageBridge';
export type {
  BridgeMessage,
  BridgeResponse,
  CommunicationChannel,
  BridgeConfig
} from './PostMessageBridge';

// Widget Container Component
export { default as WidgetContainer } from './WidgetContainer';

// Runtime Utilities
export const RuntimeUtils = {
  /**
   * Create default runtime configuration
   */
  createDefaultRuntimeConfig(): RuntimeConfig {
    return {
      sandboxPermissions: ['allow-scripts'],
      allowedOrigins: [window.location.origin],
      cspPolicy: "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;",
      maxExecutionTime: 60000,
      memoryLimit: 64,
      communicationTimeout: 30000
    };
  },

  /**
   * Create default bridge configuration
   */
  createDefaultBridgeConfig(): BridgeConfig {
    return {
      allowedOrigins: [window.location.origin],
      messageTimeout: 30000,
      maxQueueSize: 100,
      enableEncryption: false,
      rateLimitPerSecond: 50
    };
  },

  /**
   * Validate widget runtime capabilities
   */
  validateRuntimeCapabilities(): {
    hasMessageChannel: boolean;
    hasPostMessage: boolean;
    hasIframes: boolean;
    hasWorkers: boolean;
    hasWebAssembly: boolean;
    securityFeatures: string[];
  } {
    return {
      hasMessageChannel: typeof MessageChannel !== 'undefined',
      hasPostMessage: typeof window.postMessage === 'function',
      hasIframes: typeof HTMLIFrameElement !== 'undefined',
      hasWorkers: typeof Worker !== 'undefined',
      hasWebAssembly: typeof WebAssembly !== 'undefined',
      securityFeatures: [
        ...(typeof MessageChannel !== 'undefined' ? ['MessageChannel'] : []),
        ...(document.head.querySelector('meta[http-equiv="Content-Security-Policy"]') ? ['CSP'] : []),
        ...(window.isSecureContext ? ['SecureContext'] : []),
        ...(typeof crypto.subtle !== 'undefined' ? ['WebCrypto'] : [])
      ]
    };
  },

  /**
   * Generate secure iframe sandbox attributes
   */
  generateSandboxAttributes(permissions: string[]): string {
    const basePermissions = ['allow-scripts'];
    const validPermissions = [
      'allow-forms',
      'allow-popups',
      'allow-downloads',
      'allow-same-origin',
      'allow-pointer-lock',
      'allow-presentation'
    ];

    const allowedPermissions = permissions.filter(p => validPermissions.includes(p));
    return [...basePermissions, ...allowedPermissions].join(' ');
  },

  /**
   * Create Content Security Policy header
   */
  createCSPHeader(directives: Record<string, string[]>): string {
    return Object.entries(directives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  },

  /**
   * Validate message structure
   */
  validateMessage(message: any): boolean {
    return !!(
      message &&
      typeof message === 'object' &&
      message.id &&
      message.type &&
      message.timestamp &&
      typeof message.timestamp === 'number'
    );
  },

  /**
   * Calculate resource usage score
   */
  calculateResourceScore(usage: { memory: number; cpu: number; network: number }): number {
    const memoryScore = Math.min(usage.memory / 100, 1); // Normalize to 100MB
    const cpuScore = Math.min(usage.cpu / 50, 1); // Normalize to 50%
    const networkScore = Math.min(usage.network / 1000, 1); // Normalize to 1000 requests

    return (memoryScore + cpuScore + networkScore) / 3;
  },

  /**
   * Generate widget fingerprint for security
   */
  generateWidgetFingerprint(widgetId: string, code: string): string {
    // Simple hash function for widget fingerprinting
    let hash = 0;
    const combined = `${widgetId}:${code}`;

    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
  }
};

// Error Types
export class WidgetRuntimeError extends Error {
  constructor(
    message: string,
    public code: string,
    public instanceId?: string
  ) {
    super(message);
    this.name = 'WidgetRuntimeError';
  }
}

export class WidgetSecurityError extends Error {
  constructor(
    message: string,
    public violation: string,
    public instanceId?: string
  ) {
    super(message);
    this.name = 'WidgetSecurityError';
  }
}

export class WidgetCommunicationError extends Error {
  constructor(
    message: string,
    public messageType?: string,
    public instanceId?: string
  ) {
    super(message);
    this.name = 'WidgetCommunicationError';
  }
}

// Constants
export const RUNTIME_CONSTANTS = {
  MAX_WIDGET_SIZE: { width: 2000, height: 2000 },
  MIN_WIDGET_SIZE: { width: 100, height: 100 },
  DEFAULT_WIDGET_SIZE: { width: 400, height: 300 },
  MAX_MESSAGE_SIZE: 1024 * 1024, // 1MB
  MAX_EXECUTION_TIME: 300000, // 5 minutes
  DEFAULT_RATE_LIMIT: 100, // requests per minute
  VIOLATION_THRESHOLD: 5, // max violations before shutdown
  MEMORY_WARNING_THRESHOLD: 128, // MB
  CPU_WARNING_THRESHOLD: 50, // percent
  NETWORK_WARNING_THRESHOLD: 500 // requests per minute
} as const;

// Security Policies
export const SECURITY_POLICIES = {
  RESTRICTIVE: {
    name: 'Restrictive',
    description: 'Maximum security for untrusted widgets',
    sandbox: ['allow-scripts'],
    csp: "default-src 'none'; script-src 'self'; style-src 'self';",
    resourceLimits: {
      maxMemoryMB: 32,
      maxCPUPercent: 15,
      maxNetworkRequestsPerMinute: 0,
      maxStorageMB: 1,
      maxExecutionTimeMs: 30000
    }
  },
  STANDARD: {
    name: 'Standard',
    description: 'Balanced security for verified widgets',
    sandbox: ['allow-scripts', 'allow-forms'],
    csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self';",
    resourceLimits: {
      maxMemoryMB: 128,
      maxCPUPercent: 35,
      maxNetworkRequestsPerMinute: 120,
      maxStorageMB: 10,
      maxExecutionTimeMs: 120000
    }
  },
  TRUSTED: {
    name: 'Trusted',
    description: 'High permissions for trusted internal widgets',
    sandbox: ['allow-scripts', 'allow-forms', 'allow-same-origin', 'allow-popups'],
    csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src *;",
    resourceLimits: {
      maxMemoryMB: 512,
      maxCPUPercent: 60,
      maxNetworkRequestsPerMinute: 600,
      maxStorageMB: 100,
      maxExecutionTimeMs: 600000
    }
  }
} as const;

export default {
  WidgetRuntime,
  WidgetSandbox,
  PostMessageBridge,
  WidgetContainer,
  RuntimeUtils,
  WidgetRuntimeError,
  WidgetSecurityError,
  WidgetCommunicationError,
  RUNTIME_CONSTANTS,
  SECURITY_POLICIES
};