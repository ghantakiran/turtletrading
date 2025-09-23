/**
 * Widget Configuration System - Main Exports
 * Centralized configuration and theming for widgets
 */

// Configuration Management
export { default as WidgetConfigurationManager, configManager } from './WidgetConfiguration';
export type {
  WidgetConfiguration,
  WidgetConfigField,
  WidgetConfigSchema,
  ConfigGroup,
  ConfigPreset,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SelectOption,
  FieldValidation,
  FieldDependency,
  ConfigMetadata
} from './WidgetConfiguration';

// Theme Management
export { default as WidgetThemeManager, themeManager } from './WidgetTheme';
export type {
  WidgetTheme,
  ThemeColors,
  ThemeTypography,
  ThemeSpacing,
  ThemeBorders,
  ThemeShadows,
  ThemeAnimations,
  ChartTheme
} from './WidgetTheme';

// Configuration UI Components
export { default as WidgetConfigPanel } from './WidgetConfigPanel';

// Configuration Utilities
export const ConfigUtils = {
  /**
   * Create default configuration for widget
   */
  createDefaultConfig(widgetId: string, instanceId: string): WidgetConfiguration {
    return configManager.createConfiguration(widgetId, instanceId);
  },

  /**
   * Validate configuration values
   */
  validateConfig(config: WidgetConfiguration): ValidationResult {
    return configManager.validateConfiguration(config);
  },

  /**
   * Apply theme to widget
   */
  applyTheme(themeId: string): void {
    themeManager.setCurrentTheme(themeId);
  },

  /**
   * Create CSS variables for theme
   */
  createThemeVars(themeId?: string): Record<string, string> {
    return themeManager.createCSSVariables(themeId);
  },

  /**
   * Generate configuration schema from widget metadata
   */
  generateSchemaFromWidget(widget: any): WidgetConfigSchema {
    // Basic schema generation - could be expanded based on widget introspection
    return {
      version: '1.0.0',
      fields: [
        {
          key: 'refreshInterval',
          type: 'select',
          label: 'Refresh Interval',
          description: 'How often to refresh widget data',
          defaultValue: 30000,
          required: true,
          options: [
            { value: 5000, label: '5 seconds' },
            { value: 10000, label: '10 seconds' },
            { value: 30000, label: '30 seconds' },
            { value: 60000, label: '1 minute' },
            { value: 300000, label: '5 minutes' }
          ],
          group: 'general'
        }
      ],
      groups: [
        {
          id: 'general',
          label: 'General Settings',
          description: 'Basic widget configuration',
          defaultExpanded: true
        }
      ],
      presets: []
    };
  },

  /**
   * Merge configuration values with defaults
   */
  mergeWithDefaults(
    schema: WidgetConfigSchema,
    values: Record<string, any>
  ): Record<string, any> {
    const defaults: Record<string, any> = {};

    schema.fields.forEach(field => {
      defaults[field.key] = field.defaultValue;
    });

    return { ...defaults, ...values };
  },

  /**
   * Filter configuration fields by group
   */
  getFieldsByGroup(schema: WidgetConfigSchema, groupId: string): WidgetConfigField[] {
    return schema.fields.filter(field => field.group === groupId);
  },

  /**
   * Get configuration field by key
   */
  getField(schema: WidgetConfigSchema, fieldKey: string): WidgetConfigField | undefined {
    return schema.fields.find(field => field.key === fieldKey);
  },

  /**
   * Convert configuration to URL parameters
   */
  configToParams(config: Record<string, any>): URLSearchParams {
    const params = new URLSearchParams();

    Object.entries(config).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params.set(key, String(value));
      }
    });

    return params;
  },

  /**
   * Parse configuration from URL parameters
   */
  paramsToConfig(
    params: URLSearchParams,
    schema: WidgetConfigSchema
  ): Record<string, any> {
    const config: Record<string, any> = {};

    schema.fields.forEach(field => {
      const value = params.get(field.key);
      if (value !== null) {
        switch (field.type) {
          case 'number':
            config[field.key] = Number(value);
            break;
          case 'boolean':
            config[field.key] = value === 'true';
            break;
          case 'json':
            try {
              config[field.key] = JSON.parse(value);
            } catch {
              config[field.key] = field.defaultValue;
            }
            break;
          default:
            config[field.key] = value;
        }
      }
    });

    return config;
  },

  /**
   * Sanitize configuration values for security
   */
  sanitizeConfig(config: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    Object.entries(config).forEach(([key, value]) => {
      if (typeof value === 'string') {
        // Basic XSS protection
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }
};

// Configuration Constants
export const CONFIG_CONSTANTS = {
  // Field types
  FIELD_TYPES: {
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    SELECT: 'select',
    MULTISELECT: 'multiselect',
    COLOR: 'color',
    JSON: 'json'
  } as const,

  // Validation codes
  VALIDATION_CODES: {
    REQUIRED: 'REQUIRED',
    TYPE_MISMATCH: 'TYPE_MISMATCH',
    MIN_VALUE: 'MIN_VALUE',
    MAX_VALUE: 'MAX_VALUE',
    MIN_LENGTH: 'MIN_LENGTH',
    MAX_LENGTH: 'MAX_LENGTH',
    PATTERN_MISMATCH: 'PATTERN_MISMATCH',
    INVALID_OPTION: 'INVALID_OPTION',
    INVALID_JSON: 'INVALID_JSON',
    CUSTOM_VALIDATION: 'CUSTOM_VALIDATION',
    DEPENDENCY_NOT_SATISFIED: 'DEPENDENCY_NOT_SATISFIED'
  } as const,

  // Default values
  DEFAULTS: {
    REFRESH_INTERVAL: 30000,
    THEME: 'trading-light',
    VERSION: '1.0.0'
  } as const,

  // Limits
  LIMITS: {
    MAX_FIELDS: 50,
    MAX_GROUPS: 10,
    MAX_PRESETS: 20,
    MAX_FIELD_NAME_LENGTH: 50,
    MAX_DESCRIPTION_LENGTH: 200
  } as const
} as const;

// Pre-built configuration schemas for common widget types
export const WIDGET_SCHEMAS = {
  STOCK_PRICE: {
    version: '1.0.0',
    fields: [
      {
        key: 'symbol',
        type: 'string' as const,
        label: 'Stock Symbol',
        description: 'Stock ticker symbol (e.g., AAPL, MSFT)',
        defaultValue: 'AAPL',
        required: true,
        validation: {
          pattern: '^[A-Z]{1,5}$',
          minLength: 1,
          maxLength: 5
        },
        group: 'data'
      },
      {
        key: 'refreshInterval',
        type: 'select' as const,
        label: 'Refresh Interval',
        description: 'How often to update the price',
        defaultValue: 5000,
        required: true,
        options: [
          { value: 1000, label: '1 second' },
          { value: 5000, label: '5 seconds' },
          { value: 10000, label: '10 seconds' },
          { value: 30000, label: '30 seconds' }
        ],
        group: 'display'
      },
      {
        key: 'showChart',
        type: 'boolean' as const,
        label: 'Show Mini Chart',
        description: 'Display a small price chart',
        defaultValue: true,
        required: false,
        group: 'display'
      }
    ],
    groups: [
      {
        id: 'data',
        label: 'Data Settings',
        description: 'Configure data source and symbol',
        defaultExpanded: true
      },
      {
        id: 'display',
        label: 'Display Options',
        description: 'Customize appearance and updates',
        defaultExpanded: true
      }
    ],
    presets: [
      {
        id: 'apple-fast',
        name: 'Apple (Fast Updates)',
        description: 'AAPL with 1-second updates',
        config: { symbol: 'AAPL', refreshInterval: 1000, showChart: true }
      },
      {
        id: 'spy-standard',
        name: 'S&P 500 ETF',
        description: 'SPY with standard settings',
        config: { symbol: 'SPY', refreshInterval: 5000, showChart: true }
      }
    ]
  },

  MARKET_OVERVIEW: {
    version: '1.0.0',
    fields: [
      {
        key: 'indices',
        type: 'multiselect' as const,
        label: 'Market Indices',
        description: 'Select which indices to display',
        defaultValue: ['SPY', 'QQQ', 'IWM'],
        required: true,
        options: [
          { value: 'SPY', label: 'S&P 500 (SPY)' },
          { value: 'QQQ', label: 'NASDAQ (QQQ)' },
          { value: 'IWM', label: 'Russell 2000 (IWM)' },
          { value: 'VIX', label: 'Volatility Index (VIX)' }
        ],
        group: 'data'
      },
      {
        key: 'layout',
        type: 'select' as const,
        label: 'Layout Style',
        description: 'How to arrange the indices',
        defaultValue: 'grid',
        required: true,
        options: [
          { value: 'grid', label: 'Grid Layout' },
          { value: 'list', label: 'List Layout' },
          { value: 'compact', label: 'Compact View' }
        ],
        group: 'display'
      }
    ],
    groups: [
      {
        id: 'data',
        label: 'Data Selection',
        description: 'Choose which market data to show',
        defaultExpanded: true
      },
      {
        id: 'display',
        label: 'Display Settings',
        description: 'Customize the appearance',
        defaultExpanded: true
      }
    ],
    presets: [
      {
        id: 'major-indices',
        name: 'Major Indices',
        description: 'SPY, QQQ, IWM in grid layout',
        config: { indices: ['SPY', 'QQQ', 'IWM'], layout: 'grid' }
      },
      {
        id: 'with-volatility',
        name: 'Indices + Volatility',
        description: 'Major indices plus VIX',
        config: { indices: ['SPY', 'QQQ', 'IWM', 'VIX'], layout: 'grid' }
      }
    ]
  }
} as const;

export default {
  WidgetConfigurationManager,
  WidgetThemeManager,
  WidgetConfigPanel,
  configManager,
  themeManager,
  ConfigUtils,
  CONFIG_CONSTANTS,
  WIDGET_SCHEMAS
};