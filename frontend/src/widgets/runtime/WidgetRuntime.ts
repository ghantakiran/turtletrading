/**
 * Widget Runtime System
 * Provides secure execution environment for widgets with iframe sandboxing
 */

import { EventEmitter } from 'events';
import { WidgetInstance, WidgetPermission, WidgetConfig } from '../sdk/WidgetSDK';

export interface RuntimeConfig {
  sandboxPermissions: string[];
  allowedOrigins: string[];
  cspPolicy: string;
  maxExecutionTime: number;
  memoryLimit: number;
  communicationTimeout: number;
}

export interface WidgetMessage {
  id: string;
  type: string;
  source: string;
  target: string;
  payload: any;
  timestamp: number;
  signature?: string;
}

export interface WidgetSecurityContext {
  permissions: WidgetPermission[];
  origin: string;
  sandbox: string[];
  csp: string;
  trustedDomains: string[];
}

export interface RuntimeEnvironment {
  instanceId: string;
  widgetId: string;
  iframe: HTMLIFrameElement;
  securityContext: WidgetSecurityContext;
  messageChannel: MessageChannel;
  isActive: boolean;
  lastActivity: number;
  resourceUsage: {
    memory: number;
    cpu: number;
    network: number;
  };
}

export class WidgetRuntime extends EventEmitter {
  private environments: Map<string, RuntimeEnvironment> = new Map();
  private messageHandlers: Map<string, Function> = new Map();
  private config: RuntimeConfig;
  private securityValidator: SecurityValidator;

  constructor(config: RuntimeConfig) {
    super();
    this.config = config;
    this.securityValidator = new SecurityValidator(config);
    this.setupGlobalMessageHandler();
    this.startResourceMonitoring();
  }

  /**
   * Initialize widget runtime environment with secure iframe
   */
  public async initializeWidget(
    instance: WidgetInstance,
    container: HTMLElement,
    permissions: WidgetPermission[]
  ): Promise<RuntimeEnvironment> {
    const iframe = this.createSecureIframe(instance, permissions);
    const securityContext = this.createSecurityContext(instance, permissions);
    const messageChannel = new MessageChannel();

    const environment: RuntimeEnvironment = {
      instanceId: instance.id,
      widgetId: instance.widgetId,
      iframe,
      securityContext,
      messageChannel,
      isActive: false,
      lastActivity: Date.now(),
      resourceUsage: { memory: 0, cpu: 0, network: 0 }
    };

    this.environments.set(instance.id, environment);
    container.appendChild(iframe);

    // Setup secure communication channel
    await this.setupSecureCommunication(environment);

    // Load widget code with security validation
    await this.loadWidgetCode(environment, instance);

    this.emit('widgetInitialized', { instanceId: instance.id, widgetId: instance.widgetId });
    return environment;
  }

  /**
   * Create secure iframe with proper sandboxing
   */
  private createSecureIframe(
    instance: WidgetInstance,
    permissions: WidgetPermission[]
  ): HTMLIFrameElement {
    const iframe = document.createElement('iframe');

    // Generate sandbox permissions based on widget requirements
    const sandboxPermissions = this.generateSandboxPermissions(permissions);

    iframe.setAttribute('sandbox', sandboxPermissions.join(' '));
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('importance', 'low');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

    // Security headers
    iframe.style.border = 'none';
    iframe.style.width = `${instance.size.width}px`;
    iframe.style.height = `${instance.size.height}px`;
    iframe.setAttribute('data-widget-id', instance.widgetId);
    iframe.setAttribute('data-instance-id', instance.id);

    return iframe;
  }

  /**
   * Generate sandbox permissions based on widget requirements
   */
  private generateSandboxPermissions(permissions: WidgetPermission[]): string[] {
    const sandboxFlags = ['allow-scripts'];

    if (permissions.includes(WidgetPermission.NETWORK_ACCESS)) {
      sandboxFlags.push('allow-same-origin');
    }

    if (permissions.includes(WidgetPermission.FORMS)) {
      sandboxFlags.push('allow-forms');
    }

    if (permissions.includes(WidgetPermission.POPUPS)) {
      sandboxFlags.push('allow-popups');
    }

    if (permissions.includes(WidgetPermission.DOWNLOADS)) {
      sandboxFlags.push('allow-downloads');
    }

    // Always restrict navigation and modal dialogs
    return sandboxFlags;
  }

  /**
   * Setup secure communication between host and widget
   */
  private async setupSecureCommunication(environment: RuntimeEnvironment): Promise<void> {
    const { iframe, messageChannel, instanceId } = environment;

    // Setup message handler for this specific widget
    messageChannel.port1.onmessage = (event) => {
      this.handleWidgetMessage(instanceId, event.data);
    };

    // Wait for iframe to load
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Widget iframe load timeout'));
      }, this.config.communicationTimeout);

      iframe.onload = () => {
        clearTimeout(timeout);
        resolve(void 0);
      };

      iframe.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Widget iframe load error'));
      };
    });

    // Transfer port to widget iframe
    iframe.contentWindow?.postMessage('INIT_COMMUNICATION', '*', [messageChannel.port2]);
  }

  /**
   * Load and execute widget code with security validation
   */
  private async loadWidgetCode(
    environment: RuntimeEnvironment,
    instance: WidgetInstance
  ): Promise<void> {
    const widgetCode = await this.fetchWidgetCode(instance.widgetId);
    const validatedCode = await this.securityValidator.validateCode(widgetCode);

    const widgetHTML = this.generateWidgetHTML(validatedCode, environment.securityContext);

    const blob = new Blob([widgetHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    environment.iframe.src = url;
    environment.isActive = true;

    // Cleanup blob URL after loading
    environment.iframe.onload = () => {
      URL.revokeObjectURL(url);
    };
  }

  /**
   * Generate secure HTML for widget execution
   */
  private generateWidgetHTML(code: string, securityContext: WidgetSecurityContext): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${securityContext.csp}">
  <title>Widget Runtime</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      overflow: hidden;
    }
    .widget-container {
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
  </style>
</head>
<body>
  <div class="widget-container" id="widget-root"></div>

  <script>
    // Widget Runtime API
    window.WidgetAPI = {
      sendMessage: (type, payload) => {
        if (window.communicationPort) {
          window.communicationPort.postMessage({
            id: Math.random().toString(36),
            type,
            source: '${securityContext.origin}',
            target: 'host',
            payload,
            timestamp: Date.now()
          });
        }
      },

      onMessage: (handler) => {
        window.messageHandler = handler;
      },

      getPermissions: () => ${JSON.stringify(securityContext.permissions)},

      log: (level, message) => {
        window.WidgetAPI.sendMessage('LOG', { level, message, timestamp: Date.now() });
      }
    };

    // Setup communication
    window.addEventListener('message', (event) => {
      if (event.data === 'INIT_COMMUNICATION') {
        window.communicationPort = event.ports[0];
        window.communicationPort.onmessage = (msgEvent) => {
          if (window.messageHandler) {
            window.messageHandler(msgEvent.data);
          }
        };

        // Notify host that widget is ready
        window.WidgetAPI.sendMessage('WIDGET_READY', { timestamp: Date.now() });
      }
    });

    // Error handling
    window.addEventListener('error', (event) => {
      window.WidgetAPI.sendMessage('ERROR', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack
      });
    });

    // Unhandled promise rejection handling
    window.addEventListener('unhandledrejection', (event) => {
      window.WidgetAPI.sendMessage('ERROR', {
        message: 'Unhandled Promise Rejection',
        reason: event.reason
      });
    });

    // Widget code execution
    try {
      ${code}
    } catch (error) {
      window.WidgetAPI.sendMessage('ERROR', {
        message: 'Widget initialization error',
        error: error.message,
        stack: error.stack
      });
    }
  </script>
</body>
</html>`;
  }

  /**
   * Handle messages from widgets
   */
  private handleWidgetMessage(instanceId: string, message: WidgetMessage): void {
    const environment = this.environments.get(instanceId);
    if (!environment) return;

    environment.lastActivity = Date.now();

    // Validate message security
    if (!this.securityValidator.validateMessage(message, environment.securityContext)) {
      this.emit('securityViolation', { instanceId, message });
      return;
    }

    // Handle different message types
    switch (message.type) {
      case 'WIDGET_READY':
        this.handleWidgetReady(instanceId, message);
        break;

      case 'DATA_REQUEST':
        this.handleDataRequest(instanceId, message);
        break;

      case 'RESIZE_REQUEST':
        this.handleResizeRequest(instanceId, message);
        break;

      case 'ERROR':
        this.handleWidgetError(instanceId, message);
        break;

      case 'LOG':
        this.handleWidgetLog(instanceId, message);
        break;

      default:
        this.emit('widgetMessage', { instanceId, message });
    }
  }

  /**
   * Send message to specific widget
   */
  public sendMessageToWidget(instanceId: string, type: string, payload: any): boolean {
    const environment = this.environments.get(instanceId);
    if (!environment || !environment.isActive) return false;

    const message: WidgetMessage = {
      id: Math.random().toString(36),
      type,
      source: 'host',
      target: instanceId,
      payload,
      timestamp: Date.now()
    };

    environment.messageChannel.port1.postMessage(message);
    return true;
  }

  /**
   * Destroy widget runtime environment
   */
  public destroyWidget(instanceId: string): void {
    const environment = this.environments.get(instanceId);
    if (!environment) return;

    environment.isActive = false;
    environment.iframe.remove();
    environment.messageChannel.port1.close();
    environment.messageChannel.port2.close();

    this.environments.delete(instanceId);
    this.emit('widgetDestroyed', { instanceId });
  }

  /**
   * Get runtime statistics
   */
  public getRuntimeStats(): {
    activeWidgets: number;
    totalMemoryUsage: number;
    environments: RuntimeEnvironment[];
  } {
    const environments = Array.from(this.environments.values());

    return {
      activeWidgets: environments.filter(env => env.isActive).length,
      totalMemoryUsage: environments.reduce((sum, env) => sum + env.resourceUsage.memory, 0),
      environments: environments.map(env => ({
        ...env,
        iframe: undefined // Don't expose iframe reference
      })) as RuntimeEnvironment[]
    };
  }

  /**
   * Setup global message handler for iframe communication
   */
  private setupGlobalMessageHandler(): void {
    window.addEventListener('message', (event) => {
      // Only handle messages from our widget iframes
      const iframe = Array.from(this.environments.values())
        .find(env => env.iframe.contentWindow === event.source);

      if (iframe) {
        // Additional security validation can be added here
        // Messages are primarily handled through MessageChannel
      }
    });
  }

  /**
   * Start monitoring resource usage
   */
  private startResourceMonitoring(): void {
    setInterval(() => {
      this.environments.forEach((environment) => {
        this.updateResourceUsage(environment);
        this.checkWidgetHealth(environment);
      });
    }, 5000); // Check every 5 seconds
  }

  /**
   * Update resource usage for widget
   */
  private updateResourceUsage(environment: RuntimeEnvironment): void {
    // Estimate memory usage (this is simplified)
    const iframe = environment.iframe;
    const iframeDocument = iframe.contentDocument;

    if (iframeDocument) {
      const elements = iframeDocument.querySelectorAll('*').length;
      environment.resourceUsage.memory = elements * 1024; // Rough estimate
    }

    // Check for inactive widgets
    const inactiveTime = Date.now() - environment.lastActivity;
    if (inactiveTime > 300000) { // 5 minutes
      this.emit('widgetInactive', {
        instanceId: environment.instanceId,
        inactiveTime
      });
    }
  }

  /**
   * Check widget health and performance
   */
  private checkWidgetHealth(environment: RuntimeEnvironment): void {
    if (!environment.isActive) return;

    const iframe = environment.iframe;

    // Check if iframe is still responsive
    try {
      iframe.contentWindow?.postMessage('HEALTH_CHECK', '*');
    } catch (error) {
      this.emit('widgetUnresponsive', {
        instanceId: environment.instanceId,
        error: error.message
      });
    }
  }

  /**
   * Handle widget ready event
   */
  private handleWidgetReady(instanceId: string, message: WidgetMessage): void {
    const environment = this.environments.get(instanceId);
    if (environment) {
      environment.isActive = true;
      this.emit('widgetReady', { instanceId, message });
    }
  }

  /**
   * Handle data request from widget
   */
  private handleDataRequest(instanceId: string, message: WidgetMessage): void {
    this.emit('dataRequest', { instanceId, request: message.payload });
  }

  /**
   * Handle resize request from widget
   */
  private handleResizeRequest(instanceId: string, message: WidgetMessage): void {
    const { width, height } = message.payload;
    const environment = this.environments.get(instanceId);

    if (environment) {
      environment.iframe.style.width = `${width}px`;
      environment.iframe.style.height = `${height}px`;
      this.emit('widgetResize', { instanceId, width, height });
    }
  }

  /**
   * Handle widget error
   */
  private handleWidgetError(instanceId: string, message: WidgetMessage): void {
    this.emit('widgetError', { instanceId, error: message.payload });
  }

  /**
   * Handle widget log message
   */
  private handleWidgetLog(instanceId: string, message: WidgetMessage): void {
    this.emit('widgetLog', { instanceId, log: message.payload });
  }

  /**
   * Fetch widget code (placeholder for actual implementation)
   */
  private async fetchWidgetCode(widgetId: string): Promise<string> {
    // This would fetch from widget registry/CDN in actual implementation
    return `
      // Widget ${widgetId}
      const container = document.getElementById('widget-root');
      container.innerHTML = '<h3>Widget ${widgetId}</h3><p>Widget is running securely!</p>';

      // Example API usage
      window.WidgetAPI.log('info', 'Widget initialized successfully');

      // Example message handling
      window.WidgetAPI.onMessage((message) => {
        console.log('Received message:', message);
      });
    `;
  }

  /**
   * Create security context for widget
   */
  private createSecurityContext(
    instance: WidgetInstance,
    permissions: WidgetPermission[]
  ): WidgetSecurityContext {
    return {
      permissions,
      origin: window.location.origin,
      sandbox: this.generateSandboxPermissions(permissions),
      csp: this.config.cspPolicy,
      trustedDomains: this.config.allowedOrigins
    };
  }
}

/**
 * Security Validator for widget code and messages
 */
export class SecurityValidator {
  private config: RuntimeConfig;

  constructor(config: RuntimeConfig) {
    this.config = config;
  }

  /**
   * Validate widget code for security issues
   */
  public async validateCode(code: string): Promise<string> {
    // Basic security checks
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /document\.write/,
      /innerHTML\s*=/,
      /outerHTML\s*=/,
      /location\s*=/,
      /window\.open/,
      /XMLHttpRequest/,
      /fetch\s*\(/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Security violation: Dangerous pattern detected - ${pattern}`);
      }
    }

    return code;
  }

  /**
   * Validate messages from widgets
   */
  public validateMessage(
    message: WidgetMessage,
    securityContext: WidgetSecurityContext
  ): boolean {
    // Check message structure
    if (!message.id || !message.type || !message.source || !message.timestamp) {
      return false;
    }

    // Check timestamp freshness (prevent replay attacks)
    const maxAge = 30000; // 30 seconds
    if (Date.now() - message.timestamp > maxAge) {
      return false;
    }

    // Check source origin
    if (!securityContext.trustedDomains.includes(message.source)) {
      return false;
    }

    return true;
  }
}

export default WidgetRuntime;