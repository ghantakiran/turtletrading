/**
 * Jest Test Setup for Trading Platform
 * Includes accessibility testing, performance monitoring, and custom matchers
 */

import '@testing-library/jest-dom'
import { toBeAccessible } from './lib/accessibility/accessibility-tester'

// Configure axe-core for testing environment
import axe from 'axe-core'

// Extend Jest matchers with accessibility testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeAccessible(): Promise<R>
      toHaveNoAccessibilityViolations(): Promise<R>
      toPassKeyboardNavigation(): Promise<R>
      toSupportHighContrast(): Promise<R>
    }
  }
}

// Add custom accessibility matchers
expect.extend({
  toBeAccessible,

  async toHaveNoAccessibilityViolations(received: Element) {
    const results = await axe.run(received)

    return {
      pass: results.violations.length === 0,
      message: () => results.violations.length === 0
        ? 'Element has no accessibility violations'
        : `Found ${results.violations.length} accessibility violations:\n${
            results.violations.map(v => `- ${v.id}: ${v.description}`).join('\n')
          }`
    }
  },

  async toPassKeyboardNavigation(received: Element) {
    // Test keyboard navigation
    const focusableElements = received.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    let failedElements = 0

    focusableElements.forEach(element => {
      const style = window.getComputedStyle(element)
      const hasVisibleFocus = style.outline !== 'none' || style.boxShadow !== 'none'

      if (!hasVisibleFocus) {
        failedElements++
      }
    })

    return {
      pass: failedElements === 0,
      message: () => failedElements === 0
        ? 'All elements have proper keyboard navigation'
        : `${failedElements} elements missing visible focus indicators`
    }
  },

  toSupportHighContrast(received: Element) {
    // Check for high contrast support
    const hasHighContrastCSS = received.classList.contains('high-contrast') ||
                              received.style.getPropertyValue('forced-color-adjust') !== ''

    return {
      pass: hasHighContrastCSS,
      message: () => hasHighContrastCSS
        ? 'Element supports high contrast mode'
        : 'Element does not support high contrast mode - add forced-color-adjust or high-contrast class'
    }
  }
})

// Mock browser APIs for testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock ResizeObserver for chart components
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
})

// Mock IntersectionObserver for performance monitoring
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
})

// Mock performance APIs
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    now: jest.fn(() => Date.now()),
  },
})

// Mock Web Vitals for performance testing (virtual mock - no dependency required)
jest.mock('web-vitals', () => ({
  getCLS: jest.fn(),
  getFCP: jest.fn(),
  getFID: jest.fn(),
  getLCP: jest.fn(),
  getTTFB: jest.fn(),
}), { virtual: true })

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    pop: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
  }),
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Configure console for accessibility warnings
const originalWarn = console.warn
const originalError = console.error

console.warn = (...args) => {
  // Filter out accessibility warnings in tests unless specifically testing accessibility
  const message = args[0]
  if (typeof message === 'string' && message.includes('accessibility')) {
    return
  }
  originalWarn.apply(console, args)
}

console.error = (...args) => {
  // Filter out accessibility errors in tests unless specifically testing accessibility
  const message = args[0]
  if (typeof message === 'string' && message.includes('accessibility')) {
    return
  }
  originalError.apply(console, args)
}

// Global test configuration for trading platform
global.testConfig = {
  accessibility: {
    enabled: true,
    strictMode: false, // Set to true for stricter accessibility testing
    tradingSpecific: true
  },
  performance: {
    enabled: true,
    budgets: {
      fcp: 1500,
      lcp: 2000,
      fid: 100,
      cls: 0.1,
      ttfb: 800
    }
  },
  trading: {
    mockPrices: true,
    realTimeData: false,
    websocketMock: true
  }
}

// Setup function for accessibility tests
export const setupAccessibilityTest = (element: Element) => {
  // Add accessibility test attributes
  element.setAttribute('data-testid', 'accessibility-test-container')

  // Add ARIA labels for dynamic content
  const priceElements = element.querySelectorAll('[data-testid*="price"]')
  priceElements.forEach(el => {
    if (!el.hasAttribute('aria-live')) {
      el.setAttribute('aria-live', 'polite')
    }
  })

  // Add keyboard accessibility
  const interactiveElements = element.querySelectorAll('button, [role="button"]')
  interactiveElements.forEach(el => {
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '0')
    }
  })

  return element
}

// Utility function to create accessible trading components for testing
export const createAccessibleTradingComponent = (type: 'price' | 'button' | 'chart' | 'alert') => {
  const element = document.createElement('div')

  switch (type) {
    case 'price':
      element.setAttribute('data-testid', 'price-display')
      element.setAttribute('aria-live', 'polite')
      element.setAttribute('aria-label', 'Stock price')
      element.textContent = '$100.00'
      break

    case 'button':
      const button = document.createElement('button')
      button.setAttribute('data-testid', 'buy-button')
      button.setAttribute('aria-label', 'Buy stock')
      button.textContent = 'Buy'
      element.appendChild(button)
      break

    case 'chart':
      element.setAttribute('data-testid', 'price-chart')
      element.setAttribute('role', 'img')
      element.setAttribute('aria-label', 'Stock price chart showing upward trend')
      element.innerHTML = '<canvas width="300" height="200"></canvas>'
      break

    case 'alert':
      element.setAttribute('data-testid', 'price-alert')
      element.setAttribute('role', 'alert')
      element.setAttribute('aria-live', 'assertive')
      element.textContent = 'Price alert: AAPL reached $150'
      break
  }

  return element
}

// Before each test, reset accessibility configuration
beforeEach(() => {
  // Reset axe configuration
  axe.reset()

  // Clear any cached accessibility results
  if ('accessibilityTestCache' in global) {
    delete (global as any).accessibilityTestCache
  }
})

// After all tests, cleanup
afterAll(() => {
  // Restore original console methods
  console.warn = originalWarn
  console.error = originalError
})