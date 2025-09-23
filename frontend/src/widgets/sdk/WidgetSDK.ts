/**
 * TurtleTrading Widget SDK
 * Comprehensive SDK for creating, embedding, and managing dashboard widgets
 */

import { EventEmitter } from 'events';

// Widget API Types
export interface WidgetConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  category: WidgetCategory;
  permissions: WidgetPermission[];
  settings: WidgetSettings;
  dimensions: WidgetDimensions;
  author: WidgetAuthor;
  entryPoint: string;
  previewUrl?: string;
  dependencies?: string[];
  csp?: ContentSecurityPolicy;
}

export interface WidgetSettings {
  [key: string]: WidgetSettingDefinition;
}

export interface WidgetSettingDefinition {
  type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'range';
  label: string;
  description?: string;
  defaultValue: any;
  required?: boolean;
  options?: Array<{ label: string; value: any }>;
  min?: number;
  max?: number;
  validation?: (value: any) => boolean | string;
}

export interface WidgetDimensions {
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: number;
  resizable: boolean;
}

export interface WidgetAuthor {
  name: string;
  email: string;
  website?: string;
  verified: boolean;
}

export interface ContentSecurityPolicy {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  connectSrc?: string[];
  fontSrc?: string[];
}

export enum WidgetCategory {
  CHARTS = 'charts',
  INDICATORS = 'indicators',
  NEWS = 'news',
  ANALYSIS = 'analysis',
  PORTFOLIO = 'portfolio',
  ALERTS = 'alerts',
  TOOLS = 'tools',
  SOCIAL = 'social'
}

export enum WidgetPermission {
  READ_PORTFOLIO = 'read:portfolio',
  READ_WATCHLIST = 'read:watchlist',
  READ_MARKET_DATA = 'read:market-data',
  READ_USER_PROFILE = 'read:user-profile',
  WRITE_ALERTS = 'write:alerts',
  WRITE_ORDERS = 'write:orders',
  EXTERNAL_API = 'external:api',
  STORAGE = 'storage',
  NOTIFICATIONS = 'notifications'
}

// Widget Runtime Types
export interface WidgetInstance {
  id: string;
  widgetId: string;
  position: WidgetPosition;
  size: WidgetSize;
  settings: Record<string, any>;
  permissions: WidgetPermission[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetPosition {
  x: number;
  y: number;
  z: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

// Widget API Context
export interface WidgetAPIContext {
  instance: WidgetInstance;
  user: WidgetUserContext;
  theme: WidgetTheme;
  api: WidgetAPI;
  events: WidgetEventBus;
  storage: WidgetStorage;
}

export interface WidgetUserContext {
  id: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  permissions: string[];
  preferences: Record<string, any>;
}

export interface WidgetTheme {
  mode: 'light' | 'dark';
  colors: Record<string, string>;
  typography: Record<string, string>;
  spacing: Record<string, string>;
}

// Widget SDK Core Class
export class WidgetSDK extends EventEmitter {
  private static instance: WidgetSDK;
  private widgets: Map<string, WidgetConfig> = new Map();
  private instances: Map<string, WidgetInstance> = new Map();
  private apiClient: WidgetAPIClient;
  private securityManager: WidgetSecurityManager;
  private eventBus: WidgetEventBus;
  private storageManager: WidgetStorageManager;

  private constructor(apiKey: string, baseUrl: string = '/api/v1/widgets') {
    super();
    this.apiClient = new WidgetAPIClient(apiKey, baseUrl);
    this.securityManager = new WidgetSecurityManager();
    this.eventBus = new WidgetEventBus();
    this.storageManager = new WidgetStorageManager();
  }

  public static getInstance(apiKey?: string, baseUrl?: string): WidgetSDK {
    if (!WidgetSDK.instance) {
      if (!apiKey) {
        throw new Error('API key required for SDK initialization');
      }
      WidgetSDK.instance = new WidgetSDK(apiKey, baseUrl);
    }
    return WidgetSDK.instance;
  }

  /**
   * Register a new widget
   */
  public async registerWidget(config: WidgetConfig): Promise<void> {
    // Validate widget configuration
    this.validateWidgetConfig(config);

    // Security scan
    const securityReport = await this.securityManager.scanWidget(config);
    if (!securityReport.safe) {
      throw new Error(`Widget security check failed: ${securityReport.issues.join(', ')}`);
    }

    // Register with backend
    await this.apiClient.registerWidget(config);

    // Store locally
    this.widgets.set(config.id, config);

    this.emit('widget:registered', { widgetId: config.id, config });
  }

  /**
   * Create widget instance
   */
  public async createInstance(
    widgetId: string,
    position: WidgetPosition,
    size: WidgetSize,
    settings: Record<string, any> = {}
  ): Promise<WidgetInstance> {
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      throw new Error(`Widget ${widgetId} not found`);
    }

    // Validate permissions
    const hasPermissions = await this.securityManager.validatePermissions(widget.permissions);
    if (!hasPermissions) {
      throw new Error('Insufficient permissions to create widget instance');
    }

    // Validate settings
    this.validateWidgetSettings(widget.settings, settings);

    // Create instance
    const instance: WidgetInstance = {
      id: this.generateId(),
      widgetId,
      position,
      size,
      settings,
      permissions: widget.permissions,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store instance
    this.instances.set(instance.id, instance);

    // Save to backend
    await this.apiClient.createInstance(instance);

    this.emit('instance:created', { instance });

    return instance;
  }

  /**
   * Update widget instance
   */
  public async updateInstance(
    instanceId: string,
    updates: Partial<WidgetInstance>
  ): Promise<WidgetInstance> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Widget instance ${instanceId} not found`);
    }

    // Validate updates
    if (updates.settings) {
      const widget = this.widgets.get(instance.widgetId);
      if (widget) {
        this.validateWidgetSettings(widget.settings, updates.settings);
      }
    }

    // Update instance
    const updatedInstance = {
      ...instance,
      ...updates,
      updatedAt: new Date()
    };

    this.instances.set(instanceId, updatedInstance);

    // Save to backend
    await this.apiClient.updateInstance(updatedInstance);

    this.emit('instance:updated', { instance: updatedInstance, updates });

    return updatedInstance;
  }

  /**
   * Delete widget instance
   */
  public async deleteInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Widget instance ${instanceId} not found`);
    }

    // Remove from backend
    await this.apiClient.deleteInstance(instanceId);

    // Remove locally
    this.instances.delete(instanceId);

    this.emit('instance:deleted', { instanceId });
  }

  /**
   * Get widget instance context for runtime
   */
  public async getInstanceContext(instanceId: string): Promise<WidgetAPIContext> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Widget instance ${instanceId} not found`);
    }

    const user = await this.apiClient.getUserContext();
    const theme = await this.apiClient.getTheme();

    return {
      instance,
      user,
      theme,
      api: new WidgetAPI(this.apiClient, instance),
      events: this.eventBus,
      storage: this.storageManager.getInstanceStorage(instanceId)
    };
  }

  /**
   * Generate embed code for widget
   */
  public generateEmbedCode(
    instanceId: string,
    options: EmbedOptions = {}
  ): string {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Widget instance ${instanceId} not found`);
    }

    const embedUrl = this.generateEmbedUrl(instanceId, options);
    const cspHeaders = this.generateCSPHeaders(instance);

    return `<!-- TurtleTrading Widget Embed -->
<div id="turtle-widget-${instanceId}" style="width: ${instance.size.width}px; height: ${instance.size.height}px;"></div>
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${embedUrl}';
    iframe.width = '${instance.size.width}';
    iframe.height = '${instance.size.height}';
    iframe.frameBorder = '0';
    iframe.sandbox = '${this.generateSandboxAttributes(instance)}';
    iframe.allow = '${this.generateAllowAttributes(instance)}';

    // Security headers
    ${cspHeaders ? `iframe.setAttribute('csp', '${cspHeaders}');` : ''}

    // Responsive handling
    ${options.responsive ? this.generateResponsiveCode() : ''}

    // Error handling
    iframe.onerror = function() {
      console.error('Failed to load TurtleTrading widget');
      document.getElementById('turtle-widget-${instanceId}').innerHTML =
        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; color: #6b7280;">Widget failed to load</div>';
    };

    document.getElementById('turtle-widget-${instanceId}').appendChild(iframe);
  })();
</script>`;
  }

  /**
   * Create widget marketplace listing
   */
  public async publishToMarketplace(widgetId: string): Promise<void> {
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      throw new Error(`Widget ${widgetId} not found`);
    }

    // Validate for marketplace
    await this.validateForMarketplace(widget);

    // Submit to marketplace
    await this.apiClient.publishWidget(widgetId);

    this.emit('widget:published', { widgetId });
  }

  // Private helper methods

  private validateWidgetConfig(config: WidgetConfig): void {
    const required = ['id', 'name', 'version', 'category', 'permissions', 'entryPoint'];
    for (const field of required) {
      if (!config[field as keyof WidgetConfig]) {
        throw new Error(`Widget config missing required field: ${field}`);
      }
    }

    // Validate semantic version
    if (!/^\d+\.\d+\.\d+/.test(config.version)) {
      throw new Error('Widget version must follow semantic versioning (x.y.z)');
    }

    // Validate dimensions
    if (config.dimensions.minWidth <= 0 || config.dimensions.minHeight <= 0) {
      throw new Error('Widget dimensions must be positive');
    }
  }

  private validateWidgetSettings(
    definitions: WidgetSettings,
    values: Record<string, any>
  ): void {
    for (const [key, definition] of Object.entries(definitions)) {
      const value = values[key];

      // Check required fields
      if (definition.required && (value === undefined || value === null)) {
        throw new Error(`Required setting '${key}' is missing`);
      }

      // Type validation
      if (value !== undefined && value !== null) {
        if (!this.validateSettingType(definition.type, value)) {
          throw new Error(`Setting '${key}' has invalid type. Expected ${definition.type}`);
        }

        // Custom validation
        if (definition.validation) {
          const result = definition.validation(value);
          if (result !== true) {
            throw new Error(`Setting '${key}' validation failed: ${result}`);
          }
        }
      }
    }
  }

  private validateSettingType(type: string, value: any): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'color':
        return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
      default:
        return true;
    }
  }

  private generateId(): string {
    return `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEmbedUrl(instanceId: string, options: EmbedOptions): string {
    const baseUrl = this.apiClient.baseUrl.replace('/api/v1/widgets', '');
    const params = new URLSearchParams({
      instance: instanceId,
      sdk_version: '1.0.0',
      ...options
    });
    return `${baseUrl}/embed/widget?${params.toString()}`;
  }

  private generateCSPHeaders(instance: WidgetInstance): string | null {
    const widget = this.widgets.get(instance.widgetId);
    if (!widget?.csp) return null;

    const directives = Object.entries(widget.csp)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');

    return directives;
  }

  private generateSandboxAttributes(instance: WidgetInstance): string {
    const permissions = instance.permissions;
    const sandbox = ['allow-scripts', 'allow-same-origin'];

    if (permissions.includes(WidgetPermission.EXTERNAL_API)) {
      sandbox.push('allow-same-origin');
    }

    return sandbox.join(' ');
  }

  private generateAllowAttributes(instance: WidgetInstance): string {
    const permissions = instance.permissions;
    const allow = [];

    if (permissions.includes(WidgetPermission.NOTIFICATIONS)) {
      allow.push('notifications');
    }

    return allow.join('; ');
  }

  private generateResponsiveCode(): string {
    return `
    // Responsive handling
    function resizeWidget() {
      var container = document.getElementById('turtle-widget-${instance.id}');
      var iframe = container.querySelector('iframe');
      var containerWidth = container.offsetWidth;
      var aspectRatio = ${instance.size.height} / ${instance.size.width};

      iframe.width = containerWidth;
      iframe.height = containerWidth * aspectRatio;
    }

    window.addEventListener('resize', resizeWidget);
    resizeWidget();
    `;
  }

  private async validateForMarketplace(widget: WidgetConfig): Promise<void> {
    // Check if widget is properly configured
    if (!widget.description || widget.description.length < 50) {
      throw new Error('Marketplace widgets require detailed description (min 50 characters)');
    }

    if (!widget.previewUrl) {
      throw new Error('Marketplace widgets require preview URL');
    }

    // Security validation
    const securityReport = await this.securityManager.scanWidget(widget);
    if (securityReport.score < 8) {
      throw new Error(`Widget security score too low for marketplace: ${securityReport.score}/10`);
    }
  }
}

// Supporting Classes

class WidgetAPIClient {
  constructor(
    private apiKey: string,
    public baseUrl: string
  ) {}

  async registerWidget(config: WidgetConfig): Promise<void> {
    await this.request('POST', '/register', config);
  }

  async createInstance(instance: WidgetInstance): Promise<void> {
    await this.request('POST', '/instances', instance);
  }

  async updateInstance(instance: WidgetInstance): Promise<void> {
    await this.request('PUT', `/instances/${instance.id}`, instance);
  }

  async deleteInstance(instanceId: string): Promise<void> {
    await this.request('DELETE', `/instances/${instanceId}`);
  }

  async getUserContext(): Promise<WidgetUserContext> {
    return this.request('GET', '/context/user');
  }

  async getTheme(): Promise<WidgetTheme> {
    return this.request('GET', '/context/theme');
  }

  async publishWidget(widgetId: string): Promise<void> {
    await this.request('POST', `/marketplace/${widgetId}/publish`);
  }

  private async request(method: string, path: string, data?: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }
}

class WidgetSecurityManager {
  async scanWidget(config: WidgetConfig): Promise<SecurityReport> {
    const issues: string[] = [];
    let score = 10;

    // Check for suspicious permissions
    if (config.permissions.includes(WidgetPermission.WRITE_ORDERS)) {
      issues.push('Widget requests order writing permissions');
      score -= 2;
    }

    // Validate CSP
    if (!config.csp) {
      issues.push('No Content Security Policy defined');
      score -= 1;
    }

    // Check entry point
    if (!config.entryPoint.startsWith('https://') && !config.entryPoint.startsWith('/')) {
      issues.push('Entry point must use HTTPS or relative path');
      score -= 3;
    }

    return {
      safe: score >= 6,
      score,
      issues
    };
  }

  async validatePermissions(permissions: WidgetPermission[]): Promise<boolean> {
    // Check if user has granted these permissions
    // This would integrate with the main auth system
    return true; // Simplified for now
  }
}

class WidgetEventBus extends EventEmitter {
  // Widget-specific event bus for inter-widget communication
}

class WidgetStorageManager {
  getInstanceStorage(instanceId: string): WidgetStorage {
    return new WidgetStorage(instanceId);
  }
}

class WidgetStorage {
  constructor(private instanceId: string) {}

  async get(key: string): Promise<any> {
    const data = localStorage.getItem(`widget_${this.instanceId}_${key}`);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any): Promise<void> {
    localStorage.setItem(`widget_${this.instanceId}_${key}`, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(`widget_${this.instanceId}_${key}`);
  }

  async clear(): Promise<void> {
    const keys = Object.keys(localStorage).filter(key =>
      key.startsWith(`widget_${this.instanceId}_`)
    );
    keys.forEach(key => localStorage.removeItem(key));
  }
}

class WidgetAPI {
  constructor(
    private apiClient: WidgetAPIClient,
    private instance: WidgetInstance
  ) {}

  // Market data API
  async getStockPrice(symbol: string): Promise<any> {
    if (!this.instance.permissions.includes(WidgetPermission.READ_MARKET_DATA)) {
      throw new Error('No permission to read market data');
    }
    return this.apiClient.request('GET', `/market/stocks/${symbol}/price`);
  }

  // Portfolio API
  async getPortfolio(): Promise<any> {
    if (!this.instance.permissions.includes(WidgetPermission.READ_PORTFOLIO)) {
      throw new Error('No permission to read portfolio');
    }
    return this.apiClient.request('GET', '/portfolio');
  }

  // Alerts API
  async createAlert(alert: any): Promise<any> {
    if (!this.instance.permissions.includes(WidgetPermission.WRITE_ALERTS)) {
      throw new Error('No permission to create alerts');
    }
    return this.apiClient.request('POST', '/alerts', alert);
  }
}

// Interface definitions
interface EmbedOptions {
  responsive?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  [key: string]: any;
}

interface SecurityReport {
  safe: boolean;
  score: number;
  issues: string[];
}

// Export main SDK class and types
export default WidgetSDK;