/**
 * Unit tests for MarketStats chart component
 * Tests market breadth statistics, volume analysis, and market bias indicators
 */
import { render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'
import { MarketStats } from '@/app/(protected)/market/components/MarketStats'
import type { MarketData } from '@/app/(protected)/market/page'

// Mock data for testing
const mockBullishMarketData: MarketData = {
  indices: [],
  sectors: [],
  marketBreadth: {
    advancingStocks: 2850,
    decliningStocks: 1200,
    unchangedStocks: 450,
    advanceDeclineRatio: 2.38,
    newHighs: 285,
    newLows: 45,
    upVolume: 8500000000,
    downVolume: 3200000000,
    volumeRatio: 2.66,
  },
}

const mockBearishMarketData: MarketData = {
  indices: [],
  sectors: [],
  marketBreadth: {
    advancingStocks: 950,
    decliningStocks: 3100,
    unchangedStocks: 450,
    advanceDeclineRatio: 0.31,
    newHighs: 35,
    newLows: 320,
    upVolume: 2800000000,
    downVolume: 9200000000,
    volumeRatio: 0.30,
  },
}

const mockNeutralMarketData: MarketData = {
  indices: [],
  sectors: [],
  marketBreadth: {
    advancingStocks: 2100,
    decliningStocks: 2200,
    unchangedStocks: 700,
    advanceDeclineRatio: 0.95,
    newHighs: 125,
    newLows: 130,
    upVolume: 5500000000,
    downVolume: 5800000000,
    volumeRatio: 0.95,
  },
}

describe('MarketStats Component', () => {
  describe('Rendering', () => {
    it('should render market stats with header', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('Market Breadth')).toBeInTheDocument()
    })

    it('should display all four key statistics', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('Advancing')).toBeInTheDocument()
      expect(screen.getByText('Declining')).toBeInTheDocument()
      expect(screen.getByText('New Highs')).toBeInTheDocument()
      expect(screen.getByText('A/D Ratio')).toBeInTheDocument()
    })

    it('should display volume analysis section', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('Volume Analysis')).toBeInTheDocument()
      expect(screen.getByText('Up Volume')).toBeInTheDocument()
      expect(screen.getByText('Down Volume')).toBeInTheDocument()
      expect(screen.getByText('Volume Ratio')).toBeInTheDocument()
    })

    it('should display market summary section', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('Market Summary')).toBeInTheDocument()
      expect(screen.getByText('Total Issues')).toBeInTheDocument()
      expect(screen.getByText('Unchanged')).toBeInTheDocument()
      expect(screen.getByText('Market Bias')).toBeInTheDocument()
    })
  })

  describe('Data Display', () => {
    it('should display advancing stocks count and percentage', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('2850')).toBeInTheDocument()
      expect(screen.getByText('63.3%')).toBeInTheDocument() // 2850/4500
    })

    it('should display declining stocks count and percentage', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('1200')).toBeInTheDocument()
      expect(screen.getByText('26.7%')).toBeInTheDocument() // 1200/4500
    })

    it('should display new highs with comparison to new lows', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('285')).toBeInTheDocument()
      expect(screen.getByText('vs 45 lows')).toBeInTheDocument()
    })

    it('should display A/D ratio with two decimal places', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('2.38')).toBeInTheDocument()
    })

    it('should display formatted volume in billions', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('8.5B')).toBeInTheDocument() // Up Volume
      expect(screen.getByText('3.2B')).toBeInTheDocument() // Down Volume
    })

    it('should display total stocks with proper formatting', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('4,500')).toBeInTheDocument() // Total stocks formatted
    })
  })

  describe('Market Bias Classification', () => {
    it('should display "Bullish" bias for high A/D ratio', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      const biasElements = screen.getAllByText('Bullish')
      expect(biasElements.length).toBeGreaterThan(0)
    })

    it('should display "Bearish" bias for low A/D ratio', () => {
      render(<MarketStats data={mockBearishMarketData} />)

      const biasElements = screen.getAllByText('Bearish')
      expect(biasElements.length).toBeGreaterThan(0)
    })

    it('should display "Neutral" bias for balanced A/D ratio', () => {
      render(<MarketStats data={mockNeutralMarketData} />)

      expect(screen.getByText('Neutral')).toBeInTheDocument()
    })
  })

  describe('Color Coding', () => {
    it('should apply green colors for bullish metrics', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      // Advancing stocks should have green styling
      const advancingValue = screen.getByText('2850')
      expect(advancingValue).toHaveClass('text-green-600')

      const advancingContainer = advancingValue.closest('div')?.parentElement
      expect(advancingContainer).toHaveClass('bg-green-100')

      // New highs should have green styling
      const newHighsValue = screen.getByText('285')
      expect(newHighsValue).toHaveClass('text-green-600')

      // A/D ratio should have green styling when bullish
      const adRatioValue = screen.getByText('2.38')
      expect(adRatioValue).toHaveClass('text-green-600')
    })

    it('should apply red colors for bearish metrics', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      // Declining stocks should have red styling
      const decliningValue = screen.getByText('1200')
      expect(decliningValue).toHaveClass('text-red-600')

      const decliningContainer = decliningValue.closest('div')?.parentElement
      expect(decliningContainer).toHaveClass('bg-red-100')
    })

    it('should apply appropriate colors for bearish market', () => {
      render(<MarketStats data={mockBearishMarketData} />)

      // A/D ratio should have red styling when bearish
      const adRatioValue = screen.getByText('0.31')
      expect(adRatioValue).toHaveClass('text-red-600')

      const adRatioContainer = adRatioValue.closest('div')?.parentElement
      expect(adRatioContainer).toHaveClass('bg-red-100')
    })

    it('should apply correct volume colors', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      // Up volume should be green
      const upVolume = screen.getByText('8.5B')
      expect(upVolume).toHaveClass('text-green-600')

      // Down volume should be red
      const downVolume = screen.getByText('3.2B')
      expect(downVolume).toHaveClass('text-red-600')
    })

    it('should apply correct color to volume ratio', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      // Volume ratio > 1 should be green
      const volumeRatio = screen.getByText('2.66')
      expect(volumeRatio).toHaveClass('text-green-600')
    })

    it('should apply red color to bearish volume ratio', () => {
      render(<MarketStats data={mockBearishMarketData} />)

      // Volume ratio < 1 should be red
      const volumeRatio = screen.getByText('0.30')
      expect(volumeRatio).toHaveClass('text-red-600')
    })

    it('should apply correct market bias colors', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      // Market bias should be green for bullish
      const marketBias = screen.getByText('Bullish')
      expect(marketBias).toHaveClass('text-green-600')
    })

    it('should apply neutral colors for neutral market', () => {
      render(<MarketStats data={mockNeutralMarketData} />)

      // Market bias should be gray for neutral
      const marketBias = screen.getByText('Neutral')
      expect(marketBias).toHaveClass('text-gray-600')
    })
  })

  describe('Percentage Calculations', () => {
    it('should calculate advancing percentage correctly', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      // 2850 / 4500 = 63.33% → 63.3%
      expect(screen.getByText('63.3%')).toBeInTheDocument()
    })

    it('should calculate declining percentage correctly', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      // 1200 / 4500 = 26.67% → 26.7%
      expect(screen.getByText('26.7%')).toBeInTheDocument()
    })

    it('should not show percentages for new highs and A/D ratio', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      // New highs and A/D ratio should not have percentage calculations
      const newHighsContainer = screen.getByText('285').closest('div')
      expect(newHighsContainer).not.toHaveTextContent('%')

      const adRatioContainer = screen.getByText('2.38').closest('div')
      expect(adRatioContainer?.textContent).not.toMatch(/\d+\.\d+%/)
    })
  })

  describe('Data Formatting', () => {
    it('should format volume numbers in billions with one decimal place', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('8.5B')).toBeInTheDocument()
      expect(screen.getByText('3.2B')).toBeInTheDocument()
    })

    it('should format A/D ratio with two decimal places', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('2.38')).toBeInTheDocument()
    })

    it('should format volume ratio with two decimal places', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('2.66')).toBeInTheDocument()
    })

    it('should format total stocks with commas', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByText('4,500')).toBeInTheDocument()
    })

    it('should handle large numbers correctly', () => {
      const largeNumberData: MarketData = {
        indices: [],
        sectors: [],
        marketBreadth: {
          advancingStocks: 123456,
          decliningStocks: 98765,
          unchangedStocks: 12345,
          advanceDeclineRatio: 1.25,
          newHighs: 5678,
          newLows: 4321,
          upVolume: 123456789000,
          downVolume: 98765432100,
          volumeRatio: 1.25,
        },
      }

      render(<MarketStats data={largeNumberData} />)

      expect(screen.getByText('123,456')).toBeInTheDocument()
      expect(screen.getByText('98,765')).toBeInTheDocument()
      expect(screen.getByText('234,566')).toBeInTheDocument() // Total
      expect(screen.getByText('123.5B')).toBeInTheDocument() // Up volume
      expect(screen.getByText('98.8B')).toBeInTheDocument() // Down volume
    })
  })

  describe('Market Bias Thresholds', () => {
    it('should classify bias as bullish for A/D ratio > 1.2', () => {
      const strongBullishData: MarketData = {
        ...mockBullishMarketData,
        marketBreadth: {
          ...mockBullishMarketData.marketBreadth,
          advanceDeclineRatio: 1.5,
        },
      }

      render(<MarketStats data={strongBullishData} />)

      expect(screen.getByText('Bullish')).toBeInTheDocument()
    })

    it('should classify bias as bearish for A/D ratio < 0.8', () => {
      const strongBearishData: MarketData = {
        ...mockBearishMarketData,
        marketBreadth: {
          ...mockBearishMarketData.marketBreadth,
          advanceDeclineRatio: 0.6,
        },
      }

      render(<MarketStats data={strongBearishData} />)

      const biasElements = screen.getAllByText('Bearish')
      expect(biasElements.length).toBeGreaterThan(0)
    })

    it('should classify bias as neutral for A/D ratio between 0.8 and 1.2', () => {
      const neutralBiasData: MarketData = {
        ...mockNeutralMarketData,
        marketBreadth: {
          ...mockNeutralMarketData.marketBreadth,
          advanceDeclineRatio: 1.0,
        },
      }

      render(<MarketStats data={neutralBiasData} />)

      expect(screen.getByText('Neutral')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero volume gracefully', () => {
      const zeroVolumeData: MarketData = {
        ...mockBullishMarketData,
        marketBreadth: {
          ...mockBullishMarketData.marketBreadth,
          upVolume: 0,
          downVolume: 0,
          volumeRatio: 0,
        },
      }

      render(<MarketStats data={zeroVolumeData} />)

      expect(screen.getByText('0.0B')).toBeInTheDocument()
      expect(screen.getByText('0.00')).toBeInTheDocument() // Volume ratio
    })

    it('should handle zero stocks gracefully', () => {
      const zeroStocksData: MarketData = {
        ...mockBullishMarketData,
        marketBreadth: {
          ...mockBullishMarketData.marketBreadth,
          advancingStocks: 0,
          decliningStocks: 0,
          unchangedStocks: 0,
          advanceDeclineRatio: 0,
        },
      }

      render(<MarketStats data={zeroStocksData} />)

      expect(screen.getByText('0')).toBeInTheDocument() // Total stocks
      expect(screen.getByText('0.00')).toBeInTheDocument() // A/D ratio
    })

    it('should handle extreme A/D ratios', () => {
      const extremeRatioData: MarketData = {
        ...mockBullishMarketData,
        marketBreadth: {
          ...mockBullishMarketData.marketBreadth,
          advanceDeclineRatio: 999.99,
        },
      }

      render(<MarketStats data={extremeRatioData} />)

      expect(screen.getByText('999.99')).toBeInTheDocument()
    })
  })

  describe('Responsive Layout', () => {
    it('should use grid layout for statistics', () => {
      const { container } = render(<MarketStats data={mockBullishMarketData} />)

      const statsGrid = container.querySelector('.grid.grid-cols-2.lg\\:grid-cols-4')
      expect(statsGrid).toBeInTheDocument()
    })

    it('should use responsive grid for volume and summary sections', () => {
      const { container } = render(<MarketStats data={mockBullishMarketData} />)

      const summaryGrid = container.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2')
      expect(summaryGrid).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Market Breadth')
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2)
    })

    it('should have semantic structure with proper labels', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      // Check that all metrics have proper labels
      expect(screen.getByText('Advancing')).toBeInTheDocument()
      expect(screen.getByText('Declining')).toBeInTheDocument()
      expect(screen.getByText('New Highs')).toBeInTheDocument()
      expect(screen.getByText('A/D Ratio')).toBeInTheDocument()
    })

    it('should have sufficient color contrast', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      // Green colors should be dark enough
      const greenElements = document.querySelectorAll('.text-green-600')
      expect(greenElements.length).toBeGreaterThan(0)

      // Red colors should be dark enough
      const redElements = document.querySelectorAll('.text-red-600')
      expect(redElements.length).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('should render quickly with complex data', () => {
      const complexData: MarketData = {
        indices: [],
        sectors: [],
        marketBreadth: {
          advancingStocks: 9876543,
          decliningStocks: 8765432,
          unchangedStocks: 1234567,
          advanceDeclineRatio: 1.127891,
          newHighs: 56789,
          newLows: 43210,
          upVolume: 987654321000000,
          downVolume: 876543210000000,
          volumeRatio: 1.127891,
        },
      }

      const startTime = performance.now()
      render(<MarketStats data={complexData} />)
      const endTime = performance.now()

      // Rendering should be fast (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50)
    })

    it('should handle frequent updates efficiently', () => {
      const { rerender } = render(<MarketStats data={mockBullishMarketData} />)

      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        const updatedData: MarketData = {
          ...mockBullishMarketData,
          marketBreadth: {
            ...mockBullishMarketData.marketBreadth,
            advancingStocks: mockBullishMarketData.marketBreadth.advancingStocks + i,
            decliningStocks: mockBullishMarketData.marketBreadth.decliningStocks - i,
            advanceDeclineRatio: (mockBullishMarketData.marketBreadth.advancingStocks + i) / Math.max(mockBullishMarketData.marketBreadth.decliningStocks - i, 1),
          },
        }

        rerender(<MarketStats data={updatedData} />)
      }

      // Component should still be responsive
      expect(screen.getByText('Market Breadth')).toBeInTheDocument()
    })
  })

  describe('Data Consistency', () => {
    it('should maintain consistent percentage calculations', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      // Verify that percentages add up correctly (allowing for rounding)
      // 63.3% + 26.7% + 10% (unchanged) = 100%
      const advancingPercent = parseFloat(screen.getByText('63.3%').textContent?.replace('%', '') || '0')
      const decliningPercent = parseFloat(screen.getByText('26.7%').textContent?.replace('%', '') || '0')
      const unchangedPercent = (450 / 4500) * 100 // 10%

      expect(Math.abs((advancingPercent + decliningPercent + unchangedPercent) - 100)).toBeLessThan(0.1)
    })

    it('should show consistent data across different sections', () => {
      render(<MarketStats data={mockBullishMarketData} />)

      // A/D ratio should be consistent between stats grid and change text
      expect(screen.getByText('2.38')).toBeInTheDocument()
      expect(screen.getByText('Bullish')).toBeInTheDocument()

      // Volume ratio should be consistent
      expect(screen.getByText('2.66')).toBeInTheDocument()
    })
  })
});