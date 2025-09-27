/**
 * Unit tests for MarketBreadthWidget chart component
 * Tests market breadth analysis, advance/decline metrics, and volume analysis
 */
import { render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'
import { MarketBreadthWidget } from '@/app/(protected)/market/components/MarketBreadthWidget'
import type { MarketBreadth } from '@/app/(protected)/market/page'

// Mock data for testing
const mockBullishBreadthData: MarketBreadth = {
  advancingStocks: 2850,
  decliningStocks: 1200,
  unchangedStocks: 450,
  advanceDeclineRatio: 2.38,
  newHighs: 285,
  newLows: 45,
  upVolume: 8500000000,
  downVolume: 3200000000,
  volumeRatio: 2.66,
}

const mockBearishBreadthData: MarketBreadth = {
  advancingStocks: 950,
  decliningStocks: 3100,
  unchangedStocks: 450,
  advanceDeclineRatio: 0.31,
  newHighs: 35,
  newLows: 320,
  upVolume: 2800000000,
  downVolume: 9200000000,
  volumeRatio: 0.30,
}

const mockNeutralBreadthData: MarketBreadth = {
  advancingStocks: 2100,
  decliningStocks: 2200,
  unchangedStocks: 700,
  advanceDeclineRatio: 0.95,
  newHighs: 125,
  newLows: 130,
  upVolume: 5500000000,
  downVolume: 5800000000,
  volumeRatio: 0.95,
}

describe('MarketBreadthWidget Component', () => {
  describe('Rendering', () => {
    it('should render market breadth widget with header', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Market Breadth')).toBeInTheDocument()
      expect(screen.getByText('Advance/Decline analysis for 1D period')).toBeInTheDocument()
    })

    it('should display market sentiment indicator', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Market Sentiment')).toBeInTheDocument()
      expect(screen.getByText('A/D Ratio')).toBeInTheDocument()
      expect(screen.getByText('2.38')).toBeInTheDocument()
    })

    it('should display stock performance bar chart', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Stock Performance')).toBeInTheDocument()
      expect(screen.getByText('4,500 total issues')).toBeInTheDocument()
      expect(screen.getByText('Advancing: 2,850')).toBeInTheDocument()
      expect(screen.getByText('Declining: 1,200')).toBeInTheDocument()
    })

    it('should display new highs and lows metrics', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('New Highs')).toBeInTheDocument()
      expect(screen.getByText('285')).toBeInTheDocument()
      expect(screen.getByText('New Lows')).toBeInTheDocument()
      expect(screen.getByText('45')).toBeInTheDocument()
    })

    it('should display volume analysis section', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Volume Analysis')).toBeInTheDocument()
      expect(screen.getByText('Up Volume')).toBeInTheDocument()
      expect(screen.getByText('Down Volume')).toBeInTheDocument()
      expect(screen.getByText('Volume Ratio (Up/Down)')).toBeInTheDocument()
    })

    it('should display summary statistics', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Total Issues')).toBeInTheDocument()
      expect(screen.getByText('Unchanged')).toBeInTheDocument()
      expect(screen.getByText('High/Low Ratio')).toBeInTheDocument()
    })
  })

  describe('Market Sentiment Classification', () => {
    it('should display "Very Bullish" sentiment for high A/D ratio', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Very Bullish')).toBeInTheDocument()
    })

    it('should display "Very Bearish" sentiment for low A/D ratio', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBearishBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Very Bearish')).toBeInTheDocument()
    })

    it('should display "Neutral" sentiment for balanced A/D ratio', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockNeutralBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Neutral')).toBeInTheDocument()
    })

    it('should apply correct color classes for bullish sentiment', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      const sentimentText = screen.getByText('Very Bullish')
      expect(sentimentText).toHaveClass('text-green-700')

      const sentimentContainer = sentimentText.closest('div')
      expect(sentimentContainer?.parentElement).toHaveClass('bg-green-100')
    })

    it('should apply correct color classes for bearish sentiment', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBearishBreadthData}
          timeRange="1D"
        />
      )

      const sentimentText = screen.getByText('Very Bearish')
      expect(sentimentText).toHaveClass('text-red-700')

      const sentimentContainer = sentimentText.closest('div')
      expect(sentimentContainer?.parentElement).toHaveClass('bg-red-100')
    })

    it('should apply correct color classes for neutral sentiment', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockNeutralBreadthData}
          timeRange="1D"
        />
      )

      const sentimentText = screen.getByText('Neutral')
      expect(sentimentText).toHaveClass('text-gray-600')

      const sentimentContainer = sentimentText.closest('div')
      expect(sentimentContainer?.parentElement).toHaveClass('bg-gray-50')
    })
  })

  describe('Data Formatting', () => {
    it('should format A/D ratio with two decimal places', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('2.38')).toBeInTheDocument()
    })

    it('should format volume in billions', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('8.5B')).toBeInTheDocument() // Up Volume
      expect(screen.getByText('3.2B')).toBeInTheDocument() // Down Volume
    })

    it('should format volume in millions when appropriate', () => {
      const smallVolumeData: MarketBreadth = {
        ...mockBullishBreadthData,
        upVolume: 850000000, // 850M
        downVolume: 320000000, // 320M
      }

      render(
        <MarketBreadthWidget
          breadthData={smallVolumeData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('850.0M')).toBeInTheDocument()
      expect(screen.getByText('320.0M')).toBeInTheDocument()
    })

    it('should format large numbers with commas', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('4,500 total issues')).toBeInTheDocument()
      expect(screen.getByText('2,850')).toBeInTheDocument() // Advancing stocks
      expect(screen.getByText('1,200')).toBeInTheDocument() // Declining stocks
    })

    it('should calculate and display high/low ratio correctly', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      // 285 new highs / 45 new lows = 6.33
      expect(screen.getByText('6.33')).toBeInTheDocument()
    })

    it('should handle infinite high/low ratio when new lows is zero', () => {
      const noNewLowsData: MarketBreadth = {
        ...mockBullishBreadthData,
        newLows: 0,
      }

      render(
        <MarketBreadthWidget
          breadthData={noNewLowsData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('∞')).toBeInTheDocument()
    })
  })

  describe('Progress Bar Visualization', () => {
    it('should display correct percentages in advance/decline bar', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      // 2850/4500 = 63.3%, 1200/4500 = 26.7%
      expect(screen.getByText('63.3%')).toBeInTheDocument()
      expect(screen.getByText('26.7%')).toBeInTheDocument()
    })

    it('should not display percentage text for small segments', () => {
      const extremeData: MarketBreadth = {
        advancingStocks: 4200,
        decliningStocks: 200,
        unchangedStocks: 100,
        advanceDeclineRatio: 21.0,
        newHighs: 350,
        newLows: 5,
        upVolume: 9500000000,
        downVolume: 500000000,
        volumeRatio: 19.0,
      }

      render(
        <MarketBreadthWidget
          breadthData={extremeData}
          timeRange="1D"
        />
      )

      // Declining percentage (4.4%) should not show text (< 20%)
      expect(screen.queryByText('4.4%')).not.toBeInTheDocument()
      // Advancing percentage (93.3%) should show text (> 20%)
      expect(screen.getByText('93.3%')).toBeInTheDocument()
    })
  })

  describe('Volume Analysis', () => {
    it('should display volume ratio with correct formatting', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('2.66')).toBeInTheDocument()
    })

    it('should apply green color for bullish volume ratio', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      const volumeRatio = screen.getByText('2.66')
      expect(volumeRatio).toHaveClass('text-green-600')
    })

    it('should apply red color for bearish volume ratio', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBearishBreadthData}
          timeRange="1D"
        />
      )

      const volumeRatio = screen.getByText('0.30')
      expect(volumeRatio).toHaveClass('text-red-600')
    })

    it('should display volume ratio bar with correct color', () => {
      const { container } = render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      const volumeBar = container.querySelector('.bg-green-500')
      expect(volumeBar).toBeInTheDocument()
    })

    it('should display bearish volume ratio bar correctly', () => {
      const { container } = render(
        <MarketBreadthWidget
          breadthData={mockBearishBreadthData}
          timeRange="1D"
        />
      )

      const volumeBar = container.querySelector('.bg-red-500')
      expect(volumeBar).toBeInTheDocument()
    })
  })

  describe('Time Range Handling', () => {
    it('should display different time ranges correctly', () => {
      const timeRanges = ['1D', '1W', '1M', '3M', '1Y'] as const

      timeRanges.forEach(range => {
        const { rerender } = render(
          <MarketBreadthWidget
            breadthData={mockBullishBreadthData}
            timeRange={range}
          />
        )

        expect(screen.getByText(`Advance/Decline analysis for ${range} period`)).toBeInTheDocument()

        rerender(
          <MarketBreadthWidget
            breadthData={mockBullishBreadthData}
            timeRange={range}
          />
        )
      })
    })
  })

  describe('Percentage Calculations', () => {
    it('should calculate advancing percentage correctly', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      // 2850 / 4500 = 63.33%
      expect(screen.getByText('63.3%')).toBeInTheDocument()
    })

    it('should calculate declining percentage correctly', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      // 1200 / 4500 = 26.67%
      expect(screen.getByText('26.7%')).toBeInTheDocument()
    })

    it('should handle edge case with zero stocks', () => {
      const zeroStocksData: MarketBreadth = {
        advancingStocks: 0,
        decliningStocks: 0,
        unchangedStocks: 0,
        advanceDeclineRatio: 0,
        newHighs: 0,
        newLows: 0,
        upVolume: 0,
        downVolume: 0,
        volumeRatio: 0,
      }

      render(
        <MarketBreadthWidget
          breadthData={zeroStocksData}
          timeRange="1D"
        />
      )

      // Should not crash and should display zeros
      expect(screen.getByText('0 total issues')).toBeInTheDocument()
      expect(screen.getByText('0.00')).toBeInTheDocument()
    })
  })

  describe('Color Coding for Metrics', () => {
    it('should apply green color to positive metrics', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      // New highs should be in green container
      const newHighsContainer = screen.getByText('New Highs').closest('div')
      expect(newHighsContainer).toHaveClass('bg-green-50')

      const newHighsValue = screen.getByText('285')
      expect(newHighsValue).toHaveClass('text-green-600')

      // Up volume should be green
      const upVolume = screen.getByText('8.5B')
      expect(upVolume).toHaveClass('text-green-600')
    })

    it('should apply red color to negative metrics', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      // New lows should be in red container
      const newLowsContainer = screen.getByText('New Lows').closest('div')
      expect(newLowsContainer).toHaveClass('bg-red-50')

      const newLowsValue = screen.getByText('45')
      expect(newLowsValue).toHaveClass('text-red-600')

      // Down volume should be red
      const downVolume = screen.getByText('3.2B')
      expect(downVolume).toHaveClass('text-red-600')
    })

    it('should apply correct color to high/low ratio', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      // New highs > new lows, so should be green
      const ratio = screen.getByText('6.33')
      expect(ratio).toHaveClass('text-green-600')
    })

    it('should apply red color when new lows exceed new highs', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBearishBreadthData}
          timeRange="1D"
        />
      )

      // New lows > new highs, so should be red
      const ratio = screen.getByText('0.11') // 35/320
      expect(ratio).toHaveClass('text-red-600')
    })
  })

  describe('Data Validation', () => {
    it('should handle missing volume data gracefully', () => {
      const missingVolumeData: MarketBreadth = {
        ...mockBullishBreadthData,
        upVolume: 0,
        downVolume: 0,
        volumeRatio: 0,
      }

      render(
        <MarketBreadthWidget
          breadthData={missingVolumeData}
          timeRange="1D"
        />
      )

      expect(screen.getByText('0')).toBeInTheDocument() // Volume values should show as 0
    })

    it('should handle extreme values correctly', () => {
      const extremeData: MarketBreadth = {
        advancingStocks: 999999,
        decliningStocks: 1,
        unchangedStocks: 0,
        advanceDeclineRatio: 999999,
        newHighs: 999999,
        newLows: 0,
        upVolume: 999999999999,
        downVolume: 1,
        volumeRatio: 999999999999,
      }

      render(
        <MarketBreadthWidget
          breadthData={extremeData}
          timeRange="1D"
        />
      )

      // Should not crash and should format large numbers
      expect(screen.getByText('1,000,000 total issues')).toBeInTheDocument()
      expect(screen.getByText('∞')).toBeInTheDocument() // High/low ratio with 0 lows
    })
  })

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      // Check for proper heading structure
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Market Breadth')
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Volume Analysis')
    })

    it('should have appropriate contrast for color-coded elements', () => {
      render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      // Green elements should have sufficient contrast
      const greenElements = document.querySelectorAll('.text-green-600, .text-green-700')
      expect(greenElements.length).toBeGreaterThan(0)

      // Red elements should have sufficient contrast
      const redElements = document.querySelectorAll('.text-red-600, .text-red-700')
      expect(redElements.length).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('should render quickly with complex data', () => {
      const complexData: MarketBreadth = {
        advancingStocks: 2345678,
        decliningStocks: 1234567,
        unchangedStocks: 456789,
        advanceDeclineRatio: 1.895,
        newHighs: 12345,
        newLows: 6789,
        upVolume: 98765432100000,
        downVolume: 43210987600000,
        volumeRatio: 2.284,
      }

      const startTime = performance.now()
      render(
        <MarketBreadthWidget
          breadthData={complexData}
          timeRange="1D"
        />
      )
      const endTime = performance.now()

      // Rendering should be fast (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50)
    })

    it('should handle frequent updates efficiently', () => {
      const { rerender } = render(
        <MarketBreadthWidget
          breadthData={mockBullishBreadthData}
          timeRange="1D"
        />
      )

      // Simulate rapid updates
      for (let i = 0; i < 20; i++) {
        const updatedData: MarketBreadth = {
          ...mockBullishBreadthData,
          advancingStocks: mockBullishBreadthData.advancingStocks + i,
          decliningStocks: mockBullishBreadthData.decliningStocks - i,
          advanceDeclineRatio: (mockBullishBreadthData.advancingStocks + i) / (mockBullishBreadthData.decliningStocks - i || 1),
        }

        rerender(
          <MarketBreadthWidget
            breadthData={updatedData}
            timeRange="1D"
          />
        )
      }

      // Component should still be responsive
      expect(screen.getByText('Market Breadth')).toBeInTheDocument()
    })
  })
});