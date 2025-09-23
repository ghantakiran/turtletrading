/**
 * Widget Configuration System
 * Centralized configuration management for widgets with validation and persistence
 */

import { WidgetPermission } from '../sdk/WidgetSDK';
import { WidgetTheme } from './WidgetTheme';

export interface WidgetConfigField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'color' | 'json';
  label: string;
  description?: string;
  defaultValue: any;
  required: boolean;
  validation?: FieldValidation;
  options?: SelectOption[];
  group?: string;
  dependencies?: FieldDependency[];
  sensitive?: boolean;
}

export interface SelectOption {
  value: any;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: (value: any) => string | null;
}

export interface FieldDependency {
  field: string;
  value: any;
  condition: 'equals' | 'not_equals' | 'contains' | 'not_contains';
}

export interface WidgetConfigSchema {
  version: string;
  fields: WidgetConfigField[];
  groups: ConfigGroup[];
  presets: ConfigPreset[];
}

export interface ConfigGroup {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface ConfigPreset {
  id: string;
  name: string;
  description: string;
  config: Record<string, any>;
  tags?: string[];
}

export interface WidgetConfiguration {
  widgetId: string;
  instanceId: string;
  schema: WidgetConfigSchema;
  values: Record<string, any>;
  theme: string;
  permissions: WidgetPermission[];
  metadata: ConfigMetadata;
}

export interface ConfigMetadata {
  createdAt: number;
  updatedAt: number;
  version: string;
  source: 'user' | 'preset' | 'default';
  author?: string;
  locked?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export class WidgetConfigurationManager {
  private configurations: Map<string, WidgetConfiguration> = new Map();
  private schemas: Map<string, WidgetConfigSchema> = new Map();
  private globalPresets: Map<string, ConfigPreset> = new Map();

  constructor() {
    this.initializeDefaultSchemas();
  }

  /**
   * Register widget configuration schema
   */
  public registerSchema(widgetId: string, schema: WidgetConfigSchema): void {
    this.schemas.set(widgetId, schema);
  }

  /**
   * Get configuration schema for widget
   */
  public getSchema(widgetId: string): WidgetConfigSchema | undefined {
    return this.schemas.get(widgetId);
  }

  /**
   * Create new widget configuration
   */
  public createConfiguration(
    widgetId: string,
    instanceId: string,
    initialValues?: Record<string, any>
  ): WidgetConfiguration {
    const schema = this.schemas.get(widgetId);
    if (!schema) {
      throw new Error(`No schema found for widget: ${widgetId}`);
    }

    const defaultValues = this.getDefaultValues(schema);
    const values = { ...defaultValues, ...initialValues };

    const configuration: WidgetConfiguration = {
      widgetId,
      instanceId,
      schema,
      values,
      theme: 'trading-light',
      permissions: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: schema.version,
        source: 'default'
      }
    };

    this.configurations.set(instanceId, configuration);
    return configuration;
  }

  /**
   * Update widget configuration
   */
  public updateConfiguration(
    instanceId: string,
    updates: Partial<WidgetConfiguration>
  ): WidgetConfiguration {
    const config = this.configurations.get(instanceId);
    if (!config) {
      throw new Error(`No configuration found for instance: ${instanceId}`);
    }

    const updatedConfig: WidgetConfiguration = {
      ...config,
      ...updates,
      metadata: {
        ...config.metadata,
        updatedAt: Date.now()
      }
    };

    // Validate configuration
    const validation = this.validateConfiguration(updatedConfig);
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.configurations.set(instanceId, updatedConfig);
    return updatedConfig;
  }

  /**
   * Update configuration values
   */
  public updateValues(instanceId: string, values: Record<string, any>): WidgetConfiguration {
    const config = this.configurations.get(instanceId);
    if (!config) {
      throw new Error(`No configuration found for instance: ${instanceId}`);
    }

    return this.updateConfiguration(instanceId, {
      values: { ...config.values, ...values }
    });
  }

  /**
   * Get widget configuration
   */
  public getConfiguration(instanceId: string): WidgetConfiguration | undefined {
    return this.configurations.get(instanceId);
  }

  /**
   * Delete widget configuration
   */
  public deleteConfiguration(instanceId: string): boolean {
    return this.configurations.delete(instanceId);
  }

  /**
   * Validate configuration
   */
  public validateConfiguration(config: WidgetConfiguration): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate each field
    config.schema.fields.forEach(field => {
      const value = config.values[field.key];
      const fieldErrors = this.validateField(field, value);
      errors.push(...fieldErrors);

      // Check dependencies
      const dependencyWarnings = this.validateDependencies(field, config.values);
      warnings.push(...dependencyWarnings);
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Apply configuration preset
   */
  public applyPreset(instanceId: string, presetId: string): WidgetConfiguration {
    const config = this.configurations.get(instanceId);
    if (!config) {
      throw new Error(`No configuration found for instance: ${instanceId}`);
    }

    // Look for preset in schema or global presets
    const preset = config.schema.presets.find(p => p.id === presetId) ||
                   this.globalPresets.get(presetId);

    if (!preset) {
      throw new Error(`Preset not found: ${presetId}`);
    }

    return this.updateConfiguration(instanceId, {
      values: { ...config.values, ...preset.config },
      metadata: {
        ...config.metadata,
        source: 'preset'
      }
    });
  }

  /**
   * Export configuration
   */
  public exportConfiguration(instanceId: string): string {
    const config = this.configurations.get(instanceId);
    if (!config) {
      throw new Error(`No configuration found for instance: ${instanceId}`);
    }

    return JSON.stringify({
      widgetId: config.widgetId,
      values: config.values,
      theme: config.theme,
      permissions: config.permissions,
      version: config.schema.version,
      exportedAt: Date.now()
    }, null, 2);
  }

  /**
   * Import configuration
   */
  public importConfiguration(instanceId: string, configJson: string): WidgetConfiguration {
    try {
      const importedConfig = JSON.parse(configJson);
      const currentConfig = this.configurations.get(instanceId);

      if (!currentConfig) {
        throw new Error(`No configuration found for instance: ${instanceId}`);
      }

      if (importedConfig.widgetId !== currentConfig.widgetId) {
        throw new Error(`Widget ID mismatch: expected ${currentConfig.widgetId}, got ${importedConfig.widgetId}`);
      }

      return this.updateConfiguration(instanceId, {
        values: importedConfig.values,
        theme: importedConfig.theme,
        permissions: importedConfig.permissions,
        metadata: {
          ...currentConfig.metadata,
          source: 'user'
        }
      });
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error.message}`);
    }
  }

  /**
   * Create configuration form schema for UI
   */
  public createFormSchema(widgetId: string): FormSchema {
    const schema = this.schemas.get(widgetId);
    if (!schema) {
      throw new Error(`No schema found for widget: ${widgetId}`);
    }

    const formGroups = schema.groups.map(group => ({
      ...group,
      fields: schema.fields.filter(field => field.group === group.id)
    }));

    // Add ungrouped fields
    const ungroupedFields = schema.fields.filter(field => !field.group);
    if (ungroupedFields.length > 0) {
      formGroups.unshift({
        id: 'general',
        label: 'General',
        description: 'General widget settings',
        fields: ungroupedFields
      });
    }

    return {
      groups: formGroups,
      presets: schema.presets
    };
  }

  /**
   * Get field suggestions based on partial input
   */
  public getFieldSuggestions(field: WidgetConfigField, partialValue: string): SelectOption[] {
    if (field.type !== 'select' && field.type !== 'multiselect') {
      return [];
    }

    if (!field.options) {
      return [];
    }

    const searchTerm = partialValue.toLowerCase();
    return field.options.filter(option =>
      option.label.toLowerCase().includes(searchTerm) ||
      option.value.toString().toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Get all configurations for a widget type
   */
  public getConfigurationsByWidget(widgetId: string): WidgetConfiguration[] {
    return Array.from(this.configurations.values())
      .filter(config => config.widgetId === widgetId);
  }

  /**
   * Clone configuration
   */
  public cloneConfiguration(
    sourceInstanceId: string,
    targetInstanceId: string
  ): WidgetConfiguration {
    const sourceConfig = this.configurations.get(sourceInstanceId);
    if (!sourceConfig) {
      throw new Error(`No configuration found for instance: ${sourceInstanceId}`);
    }

    const clonedConfig: WidgetConfiguration = {
      ...sourceConfig,
      instanceId: targetInstanceId,
      metadata: {
        ...sourceConfig.metadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'user'
      }
    };

    this.configurations.set(targetInstanceId, clonedConfig);
    return clonedConfig;
  }

  /**
   * Validate individual field
   */
  private validateField(field: WidgetConfigField, value: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required field validation
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: field.key,
        message: `${field.label} is required`,
        code: 'REQUIRED'
      });
      return errors;
    }

    // Type validation
    if (value !== undefined && value !== null) {
      const typeError = this.validateFieldType(field, value);
      if (typeError) {
        errors.push(typeError);
      }

      // Custom validation
      if (field.validation) {
        const validationErrors = this.validateFieldConstraints(field, value);
        errors.push(...validationErrors);
      }
    }

    return errors;
  }

  /**
   * Validate field type
   */
  private validateFieldType(field: WidgetConfigField, value: any): ValidationError | null {
    switch (field.type) {
      case 'string':
        if (typeof value !== 'string') {
          return {
            field: field.key,
            message: `${field.label} must be a string`,
            code: 'TYPE_MISMATCH'
          };
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return {
            field: field.key,
            message: `${field.label} must be a valid number`,
            code: 'TYPE_MISMATCH'
          };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return {
            field: field.key,
            message: `${field.label} must be a boolean`,
            code: 'TYPE_MISMATCH'
          };
        }
        break;

      case 'select':
        if (field.options && !field.options.some(option => option.value === value)) {
          return {
            field: field.key,
            message: `${field.label} must be one of the available options`,
            code: 'INVALID_OPTION'
          };
        }
        break;

      case 'multiselect':
        if (!Array.isArray(value)) {
          return {
            field: field.key,
            message: `${field.label} must be an array`,
            code: 'TYPE_MISMATCH'
          };
        }
        break;

      case 'json':
        try {
          if (typeof value === 'string') {
            JSON.parse(value);
          }
        } catch {
          return {
            field: field.key,
            message: `${field.label} must be valid JSON`,
            code: 'INVALID_JSON'
          };
        }
        break;
    }

    return null;
  }

  /**
   * Validate field constraints
   */
  private validateFieldConstraints(field: WidgetConfigField, value: any): ValidationError[] {
    const errors: ValidationError[] = [];
    const validation = field.validation!;

    // Min/max for numbers
    if (field.type === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        errors.push({
          field: field.key,
          message: `${field.label} must be at least ${validation.min}`,
          code: 'MIN_VALUE'
        });
      }

      if (validation.max !== undefined && value > validation.max) {
        errors.push({
          field: field.key,
          message: `${field.label} must be at most ${validation.max}`,
          code: 'MAX_VALUE'
        });
      }
    }

    // Min/max length for strings
    if (field.type === 'string') {
      if (validation.minLength !== undefined && value.length < validation.minLength) {
        errors.push({
          field: field.key,
          message: `${field.label} must be at least ${validation.minLength} characters`,
          code: 'MIN_LENGTH'
        });
      }

      if (validation.maxLength !== undefined && value.length > validation.maxLength) {
        errors.push({
          field: field.key,
          message: `${field.label} must be at most ${validation.maxLength} characters`,
          code: 'MAX_LENGTH'
        });
      }

      // Pattern validation
      if (validation.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          errors.push({
            field: field.key,
            message: `${field.label} format is invalid`,
            code: 'PATTERN_MISMATCH'
          });
        }
      }
    }

    // Custom validation
    if (validation.custom) {
      const customError = validation.custom(value);
      if (customError) {
        errors.push({
          field: field.key,
          message: customError,
          code: 'CUSTOM_VALIDATION'
        });
      }
    }

    return errors;
  }

  /**
   * Validate field dependencies
   */
  private validateDependencies(
    field: WidgetConfigField,
    values: Record<string, any>
  ): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (!field.dependencies) return warnings;

    field.dependencies.forEach(dependency => {
      const dependencyValue = values[dependency.field];
      const satisfied = this.checkDependencyCondition(dependency, dependencyValue);

      if (!satisfied) {
        warnings.push({
          field: field.key,
          message: `${field.label} depends on ${dependency.field}`,
          code: 'DEPENDENCY_NOT_SATISFIED'
        });
      }
    });

    return warnings;
  }

  /**
   * Check if dependency condition is satisfied
   */
  private checkDependencyCondition(dependency: FieldDependency, value: any): boolean {
    switch (dependency.condition) {
      case 'equals':
        return value === dependency.value;
      case 'not_equals':
        return value !== dependency.value;
      case 'contains':
        return Array.isArray(value) && value.includes(dependency.value);
      case 'not_contains':
        return !Array.isArray(value) || !value.includes(dependency.value);
      default:
        return true;
    }
  }

  /**
   * Get default values from schema
   */
  private getDefaultValues(schema: WidgetConfigSchema): Record<string, any> {
    const defaults: Record<string, any> = {};

    schema.fields.forEach(field => {
      defaults[field.key] = field.defaultValue;
    });

    return defaults;
  }

  /**
   * Initialize default schemas for common widget types
   */
  private initializeDefaultSchemas(): void {
    // Stock Price Widget Schema
    this.registerSchema('stock-price', {
      version: '1.0.0',
      fields: [
        {
          key: 'symbol',
          type: 'string',
          label: 'Stock Symbol',
          description: 'Stock ticker symbol (e.g., AAPL, MSFT)',
          defaultValue: 'AAPL',
          required: true,
          validation: {
            pattern: '^[A-Z]{1,5}$',
            custom: (value) => {
              // Could validate against known symbols
              return value.length < 1 || value.length > 5 ? 'Symbol must be 1-5 characters' : null;
            }
          },
          group: 'data'
        },
        {
          key: 'refreshInterval',
          type: 'select',
          label: 'Refresh Interval',
          description: 'How often to update the price',
          defaultValue: 5000,
          required: true,
          options: [
            { value: 1000, label: '1 second' },
            { value: 5000, label: '5 seconds' },
            { value: 10000, label: '10 seconds' },
            { value: 30000, label: '30 seconds' },
            { value: 60000, label: '1 minute' }
          ],
          group: 'display'
        },
        {
          key: 'showChart',
          type: 'boolean',
          label: 'Show Mini Chart',
          description: 'Display a small price chart',
          defaultValue: true,
          required: false,
          group: 'display'
        },
        {
          key: 'chartPeriod',
          type: 'select',
          label: 'Chart Period',
          description: 'Time period for the mini chart',
          defaultValue: '1D',
          required: false,
          options: [
            { value: '1D', label: '1 Day' },
            { value: '5D', label: '5 Days' },
            { value: '1M', label: '1 Month' },
            { value: '3M', label: '3 Months' }
          ],
          dependencies: [
            { field: 'showChart', value: true, condition: 'equals' }
          ],
          group: 'display'
        }
      ],
      groups: [
        {
          id: 'data',
          label: 'Data Settings',
          description: 'Configure data source and symbol',
          icon: '📊',
          defaultExpanded: true
        },
        {
          id: 'display',
          label: 'Display Options',
          description: 'Customize appearance and updates',
          icon: '🎨',
          defaultExpanded: true
        }
      ],
      presets: [
        {
          id: 'apple-stock',
          name: 'Apple Stock',
          description: 'Pre-configured for AAPL with chart',
          config: {
            symbol: 'AAPL',
            refreshInterval: 5000,
            showChart: true,
            chartPeriod: '1D'
          },
          tags: ['stocks', 'tech']
        },
        {
          id: 'spy-etf',
          name: 'S&P 500 ETF',
          description: 'Track the S&P 500 index',
          config: {
            symbol: 'SPY',
            refreshInterval: 10000,
            showChart: true,
            chartPeriod: '5D'
          },
          tags: ['etf', 'index']
        }
      ]
    });
  }
}

interface FormSchema {
  groups: Array<ConfigGroup & { fields: WidgetConfigField[] }>;
  presets: ConfigPreset[];
}

// Create global configuration manager instance
export const configManager = new WidgetConfigurationManager();

export default WidgetConfigurationManager;