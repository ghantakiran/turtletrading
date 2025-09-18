/// <reference types="vite/client" />

/**
 * Environment variable type definitions for Vite
 * This ensures type safety when accessing import.meta.env variables
 */

interface ImportMetaEnv {
  // API Configuration
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT: string;

  // WebSocket Configuration
  readonly VITE_WS_BASE_URL: string;

  // Application Configuration
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_ENVIRONMENT: 'development' | 'production' | 'test' | 'staging';

  // Feature Flags
  readonly VITE_ENABLE_MOCK_DATA: string;
  readonly VITE_ENABLE_DEBUG_LOGGING: string;
  readonly VITE_ENABLE_PERFORMANCE_MONITORING: string;

  // External Services
  readonly VITE_ANALYTICS_ID: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_HOTJAR_ID: string;

  // Market Data Configuration
  readonly VITE_DEFAULT_SYMBOLS: string;
  readonly VITE_DEFAULT_REFRESH_INTERVAL: string;

  // UI Configuration
  readonly VITE_DEFAULT_THEME: 'light' | 'dark' | 'system';
  readonly VITE_DEFAULT_CURRENCY: string;
  readonly VITE_DEFAULT_TIMEZONE: string;

  // Development Configuration
  readonly VITE_DEV_PORT: string;
  readonly VITE_DEV_OPEN_BROWSER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Global type extensions
declare global {
  const __DEV__: boolean;
  const __PROD__: boolean;
}