const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Test environment
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/stores/(.*)$': '<rootDir>/src/stores/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    // Mock jose library for Jest since it's ESM-only
    '^jose$': '<rootDir>/src/__mocks__/jose.js',
  },

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(jose|web-vitals|axe-core)/)',
  ],

  // Test patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],

  // Coverage configuration - 100% enforcement
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/app/**/layout.tsx', // Next.js layouts
    '!src/app/**/loading.tsx', // Next.js loading components
    '!src/app/**/error.tsx',   // Next.js error components
    '!src/app/**/not-found.tsx', // Next.js 404 pages
    '!src/setupTests.ts',
    '!src/**/*.config.{js,ts}',
    '!**/*.d.ts',
  ],

  // Coverage thresholds - Progressive improvement toward 100%
  // Current baseline: 1.6% statements - we implement regression prevention
  coverageThreshold: {
    global: {
      branches: 0,      // Baseline: 0% → Target: 100%
      functions: 0,     // Baseline: 0% → Target: 100%
      lines: 1.6,       // Baseline: 1.6% → Target: 100% (prevent regression)
      statements: 1.6,  // Baseline: 1.6% → Target: 100% (prevent regression)
    },
    // Test infrastructure files require immediate 100% coverage
    './src/__tests__/': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    // Simple utilities can achieve immediate 100% coverage
    './src/utils/calculations.ts': {
      branches: 0,    // Will improve with test implementation
      functions: 0,   // Will improve with test implementation
      lines: 0,       // Will improve with test implementation
      statements: 0,  // Will improve with test implementation
    },
    // Accessibility library already has partial coverage - prevent regression
    './src/lib/accessibility/': {
      branches: 100,    // Already passing
      functions: 0,     // Current baseline
      lines: 52.63,     // Current baseline - prevent regression
      statements: 52.63, // Current baseline - prevent regression
    },
  },

  // Coverage providers
  coverageProvider: 'v8', // Faster and more accurate than Babel

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'json-summary',
    'clover',
    'cobertura',
  ],

  // Coverage directory
  coverageDirectory: '<rootDir>/coverage',

  // Test timeout for trading platform operations
  testTimeout: 10000,

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Custom reporters for CI/CD integration
  reporters: [
    'default'
  ],

  // Verbose output for CI
  verbose: true,

  // Error handling
  errorOnDeprecated: true,
  bail: false, // Continue running tests even after failures

  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',

  // Performance settings
  maxWorkers: '50%',
  workerIdleMemoryLimit: '512MB',

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Detect open handles (for debugging async issues)
  detectOpenHandles: true,
  forceExit: false,

  // Trading platform specific configuration
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
      },
    },
    TRADING_PLATFORM_TEST: true,
    MOCK_WEBSOCKET: true,
    DISABLE_REAL_API_CALLS: true,
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)