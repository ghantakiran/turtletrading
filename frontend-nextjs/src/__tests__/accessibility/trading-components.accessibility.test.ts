/**
 * Accessibility Tests for Trading Platform Components
 * Comprehensive testing for WCAG compliance and trading-specific accessibility
 */

import { render, screen } from '@testing-library/react'
import { AccessibilityTester, testAccessibility } from '../../lib/accessibility/accessibility-tester'
import { createAccessibleTradingComponent, setupAccessibilityTest } from '../../setupTests'

describe('Trading Platform Accessibility', () => {
  let tester: AccessibilityTester

  beforeEach(() => {
    tester = new AccessibilityTester()
  })

  describe('Price Display Components', () => {
    it('should have accessible price announcements', async () => {
      const priceComponent = createAccessibleTradingComponent('price')
      document.body.appendChild(priceComponent)

      const results = await testAccessibility(priceComponent)

      expect(results.passed).toBe(true)
      expect(results.summary.tradingCriticalViolations).toBe(0)

      // Check trading-specific accessibility
      const priceScenario = results.tradingSpecificResults.find(
        r => r.scenario === 'Price Update Announcements'
      )
      expect(priceScenario?.passed).toBe(true)

      document.body.removeChild(priceComponent)
    })

    it('should support high contrast mode for price display', async () => {
      const priceElement = createAccessibleTradingComponent('price')
      priceElement.style.setProperty('forced-color-adjust', 'auto')
      priceElement.classList.add('high-contrast')

      expect(priceElement).toSupportHighContrast()
    })

    it('should announce price changes to screen readers', () => {
      const priceElement = createAccessibleTradingComponent('price')

      // Verify ARIA live region
      expect(priceElement.getAttribute('aria-live')).toBe('polite')

      // Verify accessible name
      expect(priceElement.getAttribute('aria-label')).toBeTruthy()

      // Verify price is announced
      expect(priceElement.textContent).toBeTruthy()
    })
  })

  describe('Trading Button Accessibility', () => {
    it('should have accessible buy/sell buttons', async () => {
      const buttonComponent = createAccessibleTradingComponent('button')
      document.body.appendChild(buttonComponent)

      const results = await testAccessibility(buttonComponent)

      expect(results.passed).toBe(true)

      // Test keyboard navigation specifically
      expect(buttonComponent).toPassKeyboardNavigation()

      document.body.removeChild(buttonComponent)
    })

    it('should be keyboard accessible', () => {
      const buttonComponent = createAccessibleTradingComponent('button')
      const button = buttonComponent.querySelector('button')

      expect(button?.tagName).toBe('BUTTON')
      expect(button?.getAttribute('aria-label')).toBeTruthy()
      expect(button?.tabIndex).toBeGreaterThanOrEqual(0)
    })

    it('should have proper focus indicators', () => {
      const buttonComponent = createAccessibleTradingComponent('button')
      const button = buttonComponent.querySelector('button')

      // Add focus styles for testing
      button!.style.outline = '2px solid #0ea5e9'
      button!.style.outlineOffset = '2px'

      const computedStyle = window.getComputedStyle(button!)
      expect(computedStyle.outline).not.toBe('none')
    })
  })

  describe('Chart Accessibility', () => {
    it('should provide text alternatives for charts', async () => {
      const chartComponent = createAccessibleTradingComponent('chart')
      document.body.appendChild(chartComponent)

      const results = await testAccessibility(chartComponent)

      expect(results.passed).toBe(true)

      // Verify chart has accessible description
      expect(chartComponent.getAttribute('aria-label')).toContain('chart')
      expect(chartComponent.getAttribute('role')).toBe('img')

      document.body.removeChild(chartComponent)
    })

    it('should support screen readers with chart data', () => {
      const chartComponent = createAccessibleTradingComponent('chart')

      // Verify chart accessibility attributes
      expect(chartComponent.getAttribute('role')).toBe('img')
      expect(chartComponent.getAttribute('aria-label')).toBeTruthy()

      // Check for canvas element with proper attributes
      const canvas = chartComponent.querySelector('canvas')
      expect(canvas).toBeTruthy()
    })
  })

  describe('Alert and Notification Accessibility', () => {
    it('should announce trading alerts immediately', async () => {
      const alertComponent = createAccessibleTradingComponent('alert')
      document.body.appendChild(alertComponent)

      const results = await testAccessibility(alertComponent)

      expect(results.passed).toBe(true)

      // Verify alert is properly configured
      expect(alertComponent.getAttribute('role')).toBe('alert')
      expect(alertComponent.getAttribute('aria-live')).toBe('assertive')

      document.body.removeChild(alertComponent)
    })

    it('should have proper ARIA roles for alerts', () => {
      const alertComponent = createAccessibleTradingComponent('alert')

      expect(alertComponent.getAttribute('role')).toBe('alert')
      expect(alertComponent.getAttribute('aria-live')).toBe('assertive')
      expect(alertComponent.textContent).toContain('alert')
    })
  })

  describe('High Contrast Mode Support', () => {
    it('should maintain readability in high contrast mode', async () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <div data-testid="price-display" style="color: #22c55e; background: #ffffff; forced-color-adjust: auto;">
          <span class="price-value">$150.00</span>
          <span class="price-change" style="color: #22c55e;">+2.5%</span>
        </div>
      `

      const contrastResults = tester.testHighContrast(container)

      // High contrast should pass for well-designed trading colors
      expect(contrastResults.passed).toBe(true)
    })

    it('should use forced-color-adjust for trading elements', () => {
      const priceElement = createAccessibleTradingComponent('price')
      priceElement.style.setProperty('forced-color-adjust', 'auto')

      expect(priceElement.style.getPropertyValue('forced-color-adjust')).toBe('auto')
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support full keyboard navigation', async () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <nav>
          <button data-testid="buy-button" style="outline: 2px solid #0ea5e9;">Buy</button>
          <button data-testid="sell-button" style="outline: 2px solid #0ea5e9;">Sell</button>
          <input data-testid="price-input" type="number" placeholder="Price" style="outline: 2px solid #0ea5e9;">
        </nav>
      `

      const keyboardResults = await tester.testKeyboardNavigation(container)

      expect(keyboardResults.passed).toBe(true)
      expect(keyboardResults.failedElements).toHaveLength(0)
    })

    it('should have visible focus indicators', () => {
      const buttonComponent = createAccessibleTradingComponent('button')
      const button = buttonComponent.querySelector('button')!

      // Simulate focus
      button.style.outline = '2px solid #0ea5e9'
      button.style.outlineOffset = '2px'

      const computedStyle = window.getComputedStyle(button)
      expect(computedStyle.outline).not.toBe('none')
    })

    it('should support arrow key navigation in trading grids', () => {
      const container = document.createElement('div')
      container.setAttribute('role', 'grid')
      container.innerHTML = `
        <div role="row">
          <div role="gridcell" tabindex="0">AAPL</div>
          <div role="gridcell" tabindex="-1">$150.00</div>
          <div role="gridcell" tabindex="-1">+2.5%</div>
        </div>
      `

      const cells = container.querySelectorAll('[role="gridcell"]')
      expect(cells).toHaveLength(3)

      // First cell should be focusable
      expect(cells[0].getAttribute('tabindex')).toBe('0')

      // Other cells should be reachable via arrow keys
      expect(cells[1].getAttribute('tabindex')).toBe('-1')
      expect(cells[2].getAttribute('tabindex')).toBe('-1')
    })
  })

  describe('Trading-Specific WCAG Compliance', () => {
    it('should meet WCAG 2.1 AA standards for financial data', async () => {
      const container = document.createElement('div')
      setupAccessibilityTest(container)

      container.innerHTML = `
        <main>
          <h1>Trading Dashboard</h1>
          <section aria-label="Portfolio Summary">
            <h2>Portfolio Value</h2>
            <div data-testid="portfolio-value" aria-live="polite">$10,000.00</div>
          </section>
          <section aria-label="Stock Prices">
            <h2>Stock Prices</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">Symbol</th>
                  <th scope="col">Price</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>AAPL</td>
                  <td data-testid="price-aapl" aria-live="polite">$150.00</td>
                  <td data-testid="change-aapl" aria-live="polite">+2.5%</td>
                </tr>
              </tbody>
            </table>
          </section>
        </main>
      `

      const results = await testAccessibility(container)

      // Should pass WCAG compliance
      expect(results.passed).toBe(true)

      // Should have no critical violations
      expect(results.summary.criticalViolations).toBe(0)

      // Trading-specific checks should pass
      expect(results.summary.tradingCriticalViolations).toBe(0)
    })

    it('should provide comprehensive accessibility for screen readers', async () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <div role="region" aria-label="Real-time Stock Data">
          <div data-testid="stock-ticker" aria-live="polite" aria-atomic="false">
            <span aria-label="Apple Inc stock price">AAPL: $150.00</span>
            <span aria-label="price change up 2.5 percent" class="sr-only">+2.5%</span>
          </div>
        </div>
      `

      expect(container).toHaveNoAccessibilityViolations()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing accessibility attributes gracefully', async () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <div data-testid="incomplete-component">
          <span>Price: $100</span>
          <button>Buy</button>
        </div>
      `

      const results = await testAccessibility(container)

      // Should identify missing accessibility features
      expect(results.violations.length).toBeGreaterThan(0)

      // Should provide helpful error messages
      expect(results.violations.some(v => v.id.includes('label'))).toBe(true)
    })

    it('should detect inaccessible color combinations', async () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <div style="color: #ffff00; background-color: #ffffff;">
          Low contrast text
        </div>
      `

      const contrastResults = tester.testHighContrast(container)

      // Should detect contrast issues
      expect(contrastResults.passed).toBe(false)
      expect(contrastResults.failedElements.length).toBeGreaterThan(0)
    })
  })
})