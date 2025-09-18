/**
 * Environment Configuration for TurtleTrading Frontend
 * Centralizes all environment variable access with type safety and validation
 */

// Validate required environment variables
const requiredEnvVars = [
  'VITE_API_BASE_URL',
  'VITE_APP_NAME',
  'VITE_APP_VERSION',
  'VITE_APP_ENVIRONMENT'
] as const;

// Validate environment variables on module load
function validateEnvironment() {
  const missing = requiredEnvVars.filter(
    (varName) => !import.meta.env[varName]
  );

  if (missing.length > 0) {
    console.warn(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }
}

// Validate on module load
validateEnvironment();

/**
 * Environment configuration object with type safety and defaults
 */
export const env = {
  // API Configuration
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  API_TIMEOUT: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10),

  // WebSocket Configuration
  WS_BASE_URL: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000',

  // Application Configuration
  APP_NAME: import.meta.env.VITE_APP_NAME || 'TurtleTrading',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
  APP_ENVIRONMENT: import.meta.env.VITE_APP_ENVIRONMENT || 'development',

  // Environment Checks
  IS_DEVELOPMENT: import.meta.env.MODE === 'development',
  IS_PRODUCTION: import.meta.env.MODE === 'production',
  IS_TEST: import.meta.env.MODE === 'test',

  // Feature Flags
  ENABLE_MOCK_DATA: import.meta.env.VITE_ENABLE_MOCK_DATA === 'true',
  ENABLE_DEBUG_LOGGING: import.meta.env.VITE_ENABLE_DEBUG_LOGGING === 'true',
  ENABLE_PERFORMANCE_MONITORING: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true',

  // External Services
  ANALYTICS_ID: import.meta.env.VITE_ANALYTICS_ID || '',
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN || '',
  HOTJAR_ID: import.meta.env.VITE_HOTJAR_ID || '',

  // Market Data Configuration
  DEFAULT_SYMBOLS: (import.meta.env.VITE_DEFAULT_SYMBOLS || 'AAPL,MSFT,NVDA,GOOGL,META,AMZN,TSLA,JPM').split(','),
  DEFAULT_REFRESH_INTERVAL: parseInt(import.meta.env.VITE_DEFAULT_REFRESH_INTERVAL || '5000', 10),

  // UI Configuration
  DEFAULT_THEME: import.meta.env.VITE_DEFAULT_THEME || 'system',
  DEFAULT_CURRENCY: import.meta.env.VITE_DEFAULT_CURRENCY || 'USD',
  DEFAULT_TIMEZONE: import.meta.env.VITE_DEFAULT_TIMEZONE || 'America/New_York',

  // Development Configuration
  DEV_PORT: parseInt(import.meta.env.VITE_DEV_PORT || '3000', 10),
  DEV_OPEN_BROWSER: import.meta.env.VITE_DEV_OPEN_BROWSER === 'true',
} as const;

/**
 * API endpoint builder utility
 */
export const apiEndpoints = {
  // Base URLs
  base: env.API_BASE_URL,
  ws: env.WS_BASE_URL,

  // API Routes
  auth: {
    login: `${env.API_BASE_URL}/api/v1/auth/token`,
    register: `${env.API_BASE_URL}/api/v1/auth/register`,
    refresh: `${env.API_BASE_URL}/api/v1/auth/refresh-token`,
    profile: `${env.API_BASE_URL}/api/v1/auth/me`,
  },

  stock: {
    price: (symbol: string) => `${env.API_BASE_URL}/api/v1/stocks/${symbol}/price`,
    history: (symbol: string) => `${env.API_BASE_URL}/api/v1/stocks/${symbol}/history`,
    technical: (symbol: string) => `${env.API_BASE_URL}/api/v1/stocks/${symbol}/technical`,
    lstm: (symbol: string) => `${env.API_BASE_URL}/api/v1/stocks/${symbol}/lstm`,
    analysis: (symbol: string) => `${env.API_BASE_URL}/api/v1/stocks/${symbol}/analysis`,
  },

  market: {
    overview: `${env.API_BASE_URL}/api/v1/market/overview`,
    indices: `${env.API_BASE_URL}/api/v1/market/indices`,
    movers: `${env.API_BASE_URL}/api/v1/market/movers`,
    trends: `${env.API_BASE_URL}/api/v1/market/trends`,
    volatility: `${env.API_BASE_URL}/api/v1/market/volatility`,
  },

  sentiment: {
    market: `${env.API_BASE_URL}/api/v1/sentiment/market`,
    stock: (symbol: string) => `${env.API_BASE_URL}/api/v1/sentiment/stock/${symbol}`,
    news: `${env.API_BASE_URL}/api/v1/sentiment/news/trending`,
  },

  websocket: {
    connect: `${env.WS_BASE_URL}/api/v1/websocket`,
    stock: (symbol: string) => `${env.WS_BASE_URL}/api/v1/websocket/stock/${symbol}`,
    market: `${env.WS_BASE_URL}/api/v1/websocket/market`,
  },

  health: `${env.API_BASE_URL}/health`,
  docs: `${env.API_BASE_URL}/docs`,
} as const;

/**
 * Development utilities
 */
export const devUtils = {
  logEnv: () => {
    if (env.ENABLE_DEBUG_LOGGING && env.IS_DEVELOPMENT) {
      console.group('🔧 Environment Configuration');
      console.log('API Base URL:', env.API_BASE_URL);
      console.log('WebSocket URL:', env.WS_BASE_URL);
      console.log('Environment:', env.APP_ENVIRONMENT);
      console.log('Version:', env.APP_VERSION);
      console.log('Mock Data Enabled:', env.ENABLE_MOCK_DATA);
      console.log('Debug Logging:', env.ENABLE_DEBUG_LOGGING);
      console.log('Default Symbols:', env.DEFAULT_SYMBOLS);
      console.groupEnd();
    }
  },

  validateApiConnection: async (): Promise<boolean> => {
    if (!env.IS_DEVELOPMENT) return true;

    try {
      const response = await fetch(apiEndpoints.health, {
        method: 'GET',
        timeout: 5000,
      });

      const isHealthy = response.ok;

      if (env.ENABLE_DEBUG_LOGGING) {
        console.log(
          `🏥 API Health Check: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'} (${response.status})`
        );
      }

      return isHealthy;
    } catch (error) {
      if (env.ENABLE_DEBUG_LOGGING) {
        console.warn('🏥 API Health Check Failed:', error);
      }
      return false;
    }
  }
};

/**
 * Type definitions for environment
 */
export type Environment = typeof env;
export type ApiEndpoints = typeof apiEndpoints;

// Initialize development utilities
if (env.IS_DEVELOPMENT) {
  devUtils.logEnv();

  // Validate API connection on startup
  devUtils.validateApiConnection().catch(console.warn);
}

export default env;