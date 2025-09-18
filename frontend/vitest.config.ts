/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // Include patterns for comprehensive coverage
      include: [
        'src/**/*.{ts,tsx}',
        'src/**/*.{js,jsx}'
      ],

      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'src/main.tsx',
        'src/reportWebVitals.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/*.stories.{ts,tsx}',
        'src/types/**',
        'dist/**',
        'build/**'
      ],

      // 100% coverage enforcement per IMPLEMENT_FROM_DOCS_FILLED.md requirements
      thresholds: {
        global: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },

      // Ensure all files are included in coverage
      all: true,
      skipFull: false,

      // Coverage watermarks for visual indicators
      watermarks: {
        statements: [100, 100],
        functions: [100, 100],
        branches: [100, 100],
        lines: [100, 100]
      }
    },

    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}'
    ],

    // Test timeout configuration
    testTimeout: 30000,
    hookTimeout: 30000,

    // Reporter configuration for detailed output
    reporters: ['verbose', 'html', 'json'],
    outputFile: {
      html: './test-results/index.html',
      json: './test-results/results.json'
    },

    // Mock configuration
    deps: {
      inline: ['@testing-library/jest-dom']
    },

    // Threading for performance
    threads: true,
    maxThreads: 4,
    minThreads: 1,

    // UI configuration
    ui: {
      enabled: true,
      open: false,
      port: 51204
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/constants': path.resolve(__dirname, './src/constants'),
      '@/contexts': path.resolve(__dirname, './src/contexts'),
      '@/assets': path.resolve(__dirname, './src/assets'),
    },
  },
})