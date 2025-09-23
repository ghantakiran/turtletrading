/**
 * Widget Configuration Panel
 * React component for configuring widget settings with theme support
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WidgetConfiguration,
  WidgetConfigField,
  ValidationResult,
  ConfigGroup,
  ConfigPreset,
  configManager
} from './WidgetConfiguration';
import { themeManager, WidgetTheme } from './WidgetTheme';

interface WidgetConfigPanelProps {
  instanceId: string;
  onConfigChange?: (config: WidgetConfiguration) => void;
  onClose?: () => void;
  className?: string;
}

interface ConfigFieldProps {
  field: WidgetConfigField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  warning?: string;
  disabled?: boolean;
}

export const WidgetConfigPanel: React.FC<WidgetConfigPanelProps> = ({
  instanceId,
  onConfigChange,
  onClose,
  className = ''
}) => {
  const [config, setConfig] = useState<WidgetConfiguration | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>('settings');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['general']));
  const [presetSearch, setPresetSearch] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Load configuration on mount
  useEffect(() => {
    const currentConfig = configManager.getConfiguration(instanceId);
    if (currentConfig) {
      setConfig(currentConfig);
      validateConfig(currentConfig);
    }
  }, [instanceId]);

  /**
   * Validate configuration
   */
  const validateConfig = useCallback((config: WidgetConfiguration) => {
    const result = configManager.validateConfiguration(config);
    setValidation(result);
    return result;
  }, []);

  /**
   * Handle field value change
   */
  const handleFieldChange = useCallback((fieldKey: string, value: any) => {
    if (!config) return;

    const updatedConfig = configManager.updateValues(instanceId, {
      [fieldKey]: value
    });

    setConfig(updatedConfig);
    validateConfig(updatedConfig);
    setIsDirty(true);
    onConfigChange?.(updatedConfig);
  }, [config, instanceId, onConfigChange, validateConfig]);

  /**
   * Handle theme change
   */
  const handleThemeChange = useCallback((themeId: string) => {
    if (!config) return;

    const updatedConfig = configManager.updateConfiguration(instanceId, {
      theme: themeId
    });

    setConfig(updatedConfig);
    setIsDirty(true);
    onConfigChange?.(updatedConfig);
  }, [config, instanceId, onConfigChange]);

  /**
   * Apply preset
   */
  const handlePresetApply = useCallback((presetId: string) => {
    try {
      const updatedConfig = configManager.applyPreset(instanceId, presetId);
      setConfig(updatedConfig);
      validateConfig(updatedConfig);
      setIsDirty(true);
      onConfigChange?.(updatedConfig);
    } catch (error) {
      console.error('Failed to apply preset:', error);
    }
  }, [instanceId, onConfigChange, validateConfig]);

  /**
   * Export configuration
   */
  const handleExport = useCallback(() => {
    try {
      const configJson = configManager.exportConfiguration(instanceId);
      const blob = new Blob([configJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `widget-config-${instanceId}.json`;
      link.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export configuration:', error);
    }
  }, [instanceId]);

  /**
   * Import configuration
   */
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const configJson = e.target?.result as string;
        const updatedConfig = configManager.importConfiguration(instanceId, configJson);
        setConfig(updatedConfig);
        validateConfig(updatedConfig);
        setIsDirty(true);
        onConfigChange?.(updatedConfig);
      } catch (error) {
        console.error('Failed to import configuration:', error);
      }
    };
    reader.readAsText(file);
  }, [instanceId, onConfigChange, validateConfig]);

  /**
   * Toggle group expansion
   */
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const formSchema = configManager.createFormSchema(config.widgetId);
  const availableThemes = themeManager.getAllThemes();
  const filteredPresets = formSchema.presets.filter(preset =>
    preset.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
    preset.description.toLowerCase().includes(presetSearch.toLowerCase())
  );

  return (
    <div className={`widget-config-panel bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Widget Configuration
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure settings for {config.widgetId}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {isDirty && (
            <span className="text-xs text-orange-500 font-medium">Unsaved changes</span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <XIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'settings'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Settings
        </button>
        <button
          onClick={() => setActiveTab('theme')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'theme'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Theme
        </button>
        <button
          onClick={() => setActiveTab('presets')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'presets'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Presets
        </button>
        <button
          onClick={() => setActiveTab('advanced')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'advanced'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Advanced
        </button>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {formSchema.groups.map(group => (
                <ConfigGroupComponent
                  key={group.id}
                  group={group}
                  expanded={expandedGroups.has(group.id)}
                  onToggle={() => toggleGroup(group.id)}
                  config={config}
                  validation={validation}
                  onFieldChange={handleFieldChange}
                />
              ))}
            </motion.div>
          )}

          {activeTab === 'theme' && (
            <motion.div
              key="theme"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Theme
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {availableThemes.map(theme => (
                    <ThemeOption
                      key={theme.id}
                      theme={theme}
                      selected={config.theme === theme.id}
                      onSelect={() => handleThemeChange(theme.id)}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'presets' && (
            <motion.div
              key="presets"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div>
                <input
                  type="text"
                  placeholder="Search presets..."
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="space-y-2">
                {filteredPresets.map(preset => (
                  <PresetOption
                    key={preset.id}
                    preset={preset}
                    onApply={() => handlePresetApply(preset.id)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'advanced' && (
            <motion.div
              key="advanced"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <button
                  onClick={handleExport}
                  className="w-full px-4 py-2 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                >
                  Export Configuration
                </button>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Import Configuration
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                  />
                </div>

                {validation && !validation.isValid && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-400 mb-1">
                      Configuration Errors
                    </h4>
                    <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                      {validation.errors.map((error, index) => (
                        <li key={index}>• {error.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validation && validation.warnings.length > 0 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-400 mb-1">
                      Configuration Warnings
                    </h4>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                      {validation.warnings.map((warning, index) => (
                        <li key={index}>• {warning.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/**
 * Configuration group component
 */
const ConfigGroupComponent: React.FC<{
  group: ConfigGroup & { fields: WidgetConfigField[] };
  expanded: boolean;
  onToggle: () => void;
  config: WidgetConfiguration;
  validation: ValidationResult | null;
  onFieldChange: (fieldKey: string, value: any) => void;
}> = ({ group, expanded, onToggle, config, validation, onFieldChange }) => {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg"
      >
        <div className="flex items-center space-x-2">
          {group.icon && <span>{group.icon}</span>}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {group.label}
            </h4>
            {group.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {group.description}
              </p>
            )}
          </div>
        </div>
        <ChevronIcon
          className={`h-4 w-4 text-gray-400 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-4"
          >
            {group.fields.map(field => (
              <ConfigField
                key={field.key}
                field={field}
                value={config.values[field.key]}
                onChange={(value) => onFieldChange(field.key, value)}
                error={validation?.errors.find(e => e.field === field.key)?.message}
                warning={validation?.warnings.find(w => w.field === field.key)?.message}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Configuration field component
 */
const ConfigField: React.FC<ConfigFieldProps> = ({
  field,
  value,
  onChange,
  error,
  warning,
  disabled = false
}) => {
  const renderField = () => {
    const baseInputClass = `w-full px-3 py-2 border rounded-md text-sm transition-colors ${
      error
        ? 'border-red-300 dark:border-red-600 focus:ring-red-500'
        : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500'
    } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent`;

    switch (field.type) {
      case 'string':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClass}
            placeholder={field.description}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
            className={baseInputClass}
            min={field.validation?.min}
            max={field.validation?.max}
          />
        );

      case 'boolean':
        return (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {field.description || 'Enable this option'}
            </span>
          </label>
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClass}
          >
            {!field.required && <option value="">Select option...</option>}
            {field.options?.map(option => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'color':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={value || '#000000'}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="h-8 w-16 border border-gray-300 dark:border-gray-600 rounded"
            />
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className={`flex-1 ${baseInputClass}`}
              placeholder="#000000"
            />
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClass}
          />
        );
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {renderField()}

      {field.description && !error && !warning && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {field.description}
        </p>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {warning && !error && (
        <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
          {warning}
        </p>
      )}
    </div>
  );
};

/**
 * Theme option component
 */
const ThemeOption: React.FC<{
  theme: WidgetTheme;
  selected: boolean;
  onSelect: () => void;
}> = ({ theme, selected, onSelect }) => {
  return (
    <button
      onClick={onSelect}
      className={`p-3 border rounded-lg text-left transition-colors ${
        selected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {theme.name}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {theme.description}
          </p>
        </div>
        {selected && (
          <CheckIcon className="h-4 w-4 text-primary-500" />
        )}
      </div>

      {/* Theme preview */}
      <div className="mt-2 flex space-x-1">
        <div
          className="w-4 h-4 rounded"
          style={{ backgroundColor: theme.colors.primary }}
        />
        <div
          className="w-4 h-4 rounded"
          style={{ backgroundColor: theme.colors.background }}
        />
        <div
          className="w-4 h-4 rounded"
          style={{ backgroundColor: theme.colors.bull }}
        />
        <div
          className="w-4 h-4 rounded"
          style={{ backgroundColor: theme.colors.bear }}
        />
      </div>
    </button>
  );
};

/**
 * Preset option component
 */
const PresetOption: React.FC<{
  preset: ConfigPreset;
  onApply: () => void;
}> = ({ preset, onApply }) => {
  return (
    <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {preset.name}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {preset.description}
          </p>
          {preset.tags && (
            <div className="flex space-x-1 mt-2">
              {preset.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onApply}
          className="ml-3 px-3 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  );
};

// Icons
const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export default WidgetConfigPanel;