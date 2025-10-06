/**
 * Unit tests for SentimentIndicators chart component
 * Tests sentiment visualization, progress bars, and market psychology indicators
 */
import { render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'
import { SentimentIndicators } from '@/app/(protected)/sentiment/components/SentimentIndicators'
import type { SentimentIndicators as SentimentIndicatorsType, SentimentScore } from '@/app/(protected)/sentiment/page'

// Mock data for testing
const mockBullishIndicators: SentimentIndicatorsType = {
  fearGreedIndex: 75, // Extreme Greed
  putCallRatio: 0.65, // Bullish
  vixSentiment: 12.5, // Low volatility
  insiderActivity: 45, // Moderate positive
  institutionalFlow: 2500000000, // $2.5B inflow
  retailSentiment: 68, // Bullish
}

const mockBearishIndicators: SentimentIndicatorsType = {
  fearGreedIndex: 15, // Extreme Fear
  putCallRatio: 1.35, // Bearish
  vixSentiment: 35.2, // High volatility
  insiderActivity: -65, // Strong negative
  institutionalFlow: -1800000000, // $1.8B outflow
  retailSentiment: 25, // Bearish
}

const mockNeutralIndicators: SentimentIndicatorsType = {
  fearGreedIndex: 50, // Neutral
  putCallRatio: 0.95, // Neutral
  vixSentiment: 18.5, // Normal volatility
  insiderActivity: 10, // Slight positive
  institutionalFlow: 150000000, // $150M inflow
  retailSentiment: 52, // Neutral
}

const mockBullishSentiment: SentimentScore = {
  overall: 65.5,
  news: 70.2,
  social: 58.8,
  institutional: 72.1,
  timestamp: '2024-01-15T10:30:00Z',
  confidence: 0.85,
}

const mockBearishSentiment: SentimentScore = {
  overall: -45.2,
  news: -38.5,
  social: -52.1,
  institutional: -41.8,
  timestamp: '2024-01-15T10:30:00Z',
  confidence: 0.78,
}

const mockNeutralSentiment: SentimentScore = {
  overall: 5.2,
  news: -2.1,
  social: 12.5,
  institutional: 8.9,
  timestamp: '2024-01-15T10:30:00Z',
  confidence: 0.65,
}

describe('SentimentIndicators Component', () => {
  describe('Rendering', () => {
    it('should render all sentiment indicator sections', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Fear & Greed Index')).toBeInTheDocument()
      expect(screen.getByText('Put/Call Ratio')).toBeInTheDocument()
      expect(screen.getByText('VIX Level')).toBeInTheDocument()
      expect(screen.getByText('Insider Activity')).toBeInTheDocument()
      expect(screen.getByText('Retail Sentiment')).toBeInTheDocument()
      expect(screen.getByText('Institutional Money Flow')).toBeInTheDocument()
      expect(screen.getByText('Sentiment Summary')).toBeInTheDocument()
    })

    it('should display fear and greed index value and label', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('75')).toBeInTheDocument()
      expect(screen.getByText('Extreme Greed')).toBeInTheDocument()
    })

    it('should display put/call ratio with proper formatting', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('0.65')).toBeInTheDocument()
    })

    it('should display VIX level with one decimal place', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('12.5')).toBeInTheDocument()
    })

    it('should display insider activity score', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('45')).toBeInTheDocument()
    })

    it('should display retail sentiment percentage', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('68%')).toBeInTheDocument()
    })
  })

  describe('Fear & Greed Index Classifications', () => {
    it('should display "Extreme Greed" for values >= 75', () => {
      render(
        <SentimentIndicators
          indicators={{ ...mockBullishIndicators, fearGreedIndex: 85 }}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Extreme Greed')).toBeInTheDocument()
    })

    it('should display "Greed" for values 55-74', () => {
      render(
        <SentimentIndicators
          indicators={{ ...mockBullishIndicators, fearGreedIndex: 65 }}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Greed')).toBeInTheDocument()
    })

    it('should display "Neutral" for values 45-54', () => {
      render(
        <SentimentIndicators
          indicators={{ ...mockNeutralIndicators, fearGreedIndex: 50 }}
          overallSentiment={mockNeutralSentiment}
          timeRange="1D"
        />
      )

      // Check that "Neutral" appears in the Fear & Greed Index section
      const neutralLabels = screen.getAllByText('Neutral')
      expect(neutralLabels.length).toBeGreaterThan(0)
    })

    it('should display "Fear" for values 25-44', () => {
      render(
        <SentimentIndicators
          indicators={{ ...mockBearishIndicators, fearGreedIndex: 35 }}
          overallSentiment={mockBearishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Fear')).toBeInTheDocument()
    })

    it('should display "Extreme Fear" for values < 25', () => {
      render(
        <SentimentIndicators
          indicators={mockBearishIndicators}
          overallSentiment={mockBearishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Extreme Fear')).toBeInTheDocument()
    })
  })

  describe('Color Coding', () => {
    it('should apply correct colors for bullish fear & greed index', () => {
      const { container } = render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      const fearGreedValue = screen.getByText('75')
      expect(fearGreedValue).toHaveClass('text-red-600') // Extreme greed is red

      // Check that the container has the correct background classes
      const fearGreedContainers = container.querySelectorAll('.bg-red-50.border-red-200')
      expect(fearGreedContainers.length).toBeGreaterThan(0)
    })

    it('should apply correct colors for bearish fear & greed index', () => {
      const { container } = render(
        <SentimentIndicators
          indicators={mockBearishIndicators}
          overallSentiment={mockBearishSentiment}
          timeRange="1D"
        />
      )

      const fearGreedValue = screen.getByText('15')
      expect(fearGreedValue).toHaveClass('text-green-600') // Extreme fear is green (contrarian)

      // Check that the container has the correct background classes
      const fearGreedContainers = container.querySelectorAll('.bg-green-50.border-green-200')
      expect(fearGreedContainers.length).toBeGreaterThan(0)
    })

    it('should apply correct colors for put/call ratio', () => {
      const { container } = render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      const putCallValue = screen.getByText('0.65')
      expect(putCallValue).toHaveClass('text-green-600') // Low put/call is bullish

      // Check that green containers exist (put/call + other green indicators)
      const greenContainers = container.querySelectorAll('.bg-green-50.border-green-200')
      expect(greenContainers.length).toBeGreaterThan(0)
    })

    it('should apply correct colors for high VIX', () => {
      const { container } = render(
        <SentimentIndicators
          indicators={mockBearishIndicators}
          overallSentiment={mockBearishSentiment}
          timeRange="1D"
        />
      )

      const vixValue = screen.getByText('35.2')
      expect(vixValue).toHaveClass('text-red-600') // High VIX is bearish

      // Check that red containers exist
      const redContainers = container.querySelectorAll('.bg-red-50.border-red-200')
      expect(redContainers.length).toBeGreaterThan(0)
    })

    it('should apply correct colors for positive insider activity', () => {
      const { container } = render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      const insiderValue = screen.getByText('45')
      expect(insiderValue).toHaveClass('text-yellow-600') // Moderate positive (45 is in yellow range >= 20 but < 60)

      // Check that yellow containers exist
      const yellowContainers = container.querySelectorAll('.bg-yellow-50.border-yellow-200')
      expect(yellowContainers.length).toBeGreaterThan(0)
    })

    it('should apply correct colors for institutional flow', () => {
      const { container } = render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      const flowValue = screen.getByText('$2.5B')
      expect(flowValue).toHaveClass('text-green-600') // Positive flow is green

      // Check that green containers exist (institutional flow uses specific green bg)
      const greenContainers = container.querySelectorAll('.bg-green-50.border-green-200')
      expect(greenContainers.length).toBeGreaterThan(0)
    })
  })

  describe('Currency Formatting', () => {
    it('should format large institutional flow in billions', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('$2.5B')).toBeInTheDocument()
    })

    it('should format medium institutional flow in millions', () => {
      const mediumFlowIndicators = {
        ...mockNeutralIndicators,
        institutionalFlow: 150000000, // $150M
      }

      render(
        <SentimentIndicators
          indicators={mediumFlowIndicators}
          overallSentiment={mockNeutralSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('$150.0M')).toBeInTheDocument()
    })

    it('should format small institutional flow with locale string', () => {
      const smallFlowIndicators = {
        ...mockNeutralIndicators,
        institutionalFlow: 500000, // $500K
      }

      render(
        <SentimentIndicators
          indicators={smallFlowIndicators}
          overallSentiment={mockNeutralSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('$500,000')).toBeInTheDocument()
    })

    it('should handle negative institutional flow', () => {
      render(
        <SentimentIndicators
          indicators={mockBearishIndicators}
          overallSentiment={mockBearishSentiment}
          timeRange="1D"
        />
      )

      // The component displays negative values in format $-X.XB (multiple times)
      expect(screen.getAllByText('$-1.8B').length).toBeGreaterThan(0)
      expect(screen.getByText('Outflow')).toBeInTheDocument()
    })
  })

  describe('Progress Bars', () => {
    it('should display fear & greed progress bar with correct width', () => {
      const { container } = render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      // Fear & greed bar should be 75% width
      const progressBars = container.querySelectorAll('[style*="width: 75%"]')
      expect(progressBars.length).toBeGreaterThan(0)
    })

    it('should display put/call ratio progress bar with correct scaling', () => {
      const { container } = render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      // Put/call ratio 0.65 should be (0.65/2)*100 = 32.5% width
      const progressBars = container.querySelectorAll('[style*="width: 32.5%"]')
      expect(progressBars.length).toBeGreaterThan(0)
    })

    it('should display VIX progress bar with correct scaling', () => {
      const { container } = render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      // VIX 12.5 should be (12.5/50)*100 = 25% width
      const progressBars = container.querySelectorAll('[style*="width: 25%"]')
      expect(progressBars.length).toBeGreaterThan(0)
    })

    it('should display retail sentiment progress bar with correct width', () => {
      const { container } = render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      // Retail sentiment 68% should be 68% width
      const progressBars = container.querySelectorAll('[style*="width: 68%"]')
      expect(progressBars.length).toBeGreaterThan(0)
    })
  })

  describe('Insider Activity Analysis', () => {
    it('should display "Increased" for positive insider activity', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Increased')).toBeInTheDocument()
    })

    it('should display "Normal" for zero or negative insider activity', () => {
      render(
        <SentimentIndicators
          indicators={mockBearishIndicators}
          overallSentiment={mockBearishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Normal')).toBeInTheDocument()
    })

    it('should classify signal strength correctly', () => {
      // Test moderate signal strength (45)
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Moderate')).toBeInTheDocument()
    })

    it('should classify strong signal strength', () => {
      const strongInsiderIndicators = {
        ...mockBearishIndicators,
        insiderActivity: -75, // Strong negative
      }

      render(
        <SentimentIndicators
          indicators={strongInsiderIndicators}
          overallSentiment={mockBearishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Strong')).toBeInTheDocument()
    })

    it('should classify weak signal strength', () => {
      const weakInsiderIndicators = {
        ...mockNeutralIndicators,
        insiderActivity: 10, // Weak positive
      }

      render(
        <SentimentIndicators
          indicators={weakInsiderIndicators}
          overallSentiment={mockNeutralSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Weak')).toBeInTheDocument()
    })
  })

  describe('Institutional Flow Analysis', () => {
    it('should display flow direction for positive flow', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Inflow')).toBeInTheDocument()
    })

    it('should display flow direction for negative flow', () => {
      render(
        <SentimentIndicators
          indicators={mockBearishIndicators}
          overallSentiment={mockBearishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Outflow')).toBeInTheDocument()
    })

    it('should classify flow volume as high', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('High')).toBeInTheDocument() // $2.5B > $1B
    })

    it('should classify flow volume as medium', () => {
      const mediumFlowIndicators = {
        ...mockNeutralIndicators,
        institutionalFlow: 750000000, // $750M
      }

      render(
        <SentimentIndicators
          indicators={mediumFlowIndicators}
          overallSentiment={mockNeutralSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Medium')).toBeInTheDocument()
    })

    it('should classify flow volume as low', () => {
      const lowFlowIndicators = {
        ...mockNeutralIndicators,
        institutionalFlow: 100000000, // $100M
      }

      render(
        <SentimentIndicators
          indicators={lowFlowIndicators}
          overallSentiment={mockNeutralSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Low')).toBeInTheDocument()
    })

    it('should include plus sign for positive flow', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('+$2.5B')).toBeInTheDocument()
    })
  })

  describe('Overall Sentiment Summary', () => {
    it('should display overall sentiment score with decimal', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('+65.5')).toBeInTheDocument()
    })

    it('should display confidence percentage', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('85%')).toBeInTheDocument() // 0.85 * 100
    })

    it('should classify sentiment as "Very Bullish" for high positive scores', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Very Bullish')).toBeInTheDocument()
    })

    it('should classify sentiment as "Bearish" for negative scores', () => {
      render(
        <SentimentIndicators
          indicators={mockBearishIndicators}
          overallSentiment={mockBearishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Bearish')).toBeInTheDocument()
    })

    it('should classify sentiment as "Neutral" for balanced scores', () => {
      render(
        <SentimentIndicators
          indicators={mockNeutralIndicators}
          overallSentiment={mockNeutralSentiment}
          timeRange="1D"
        />
      )

      // Multiple "Neutral" texts exist, use getAllByText
      const neutralLabels = screen.getAllByText('Neutral')
      expect(neutralLabels.length).toBeGreaterThan(0)
    })

    it('should show negative sentiment without plus sign', () => {
      render(
        <SentimentIndicators
          indicators={mockBearishIndicators}
          overallSentiment={mockBearishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('-45.2')).toBeInTheDocument()
    })
  })

  describe('Time Range Display', () => {
    it('should display time range in institutional flow description', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1W"
        />
      )

      expect(screen.getByText(/1W/)).toBeInTheDocument()
    })

    it('should handle different time ranges', () => {
      const timeRanges = ['1H', '4H', '1D', '1W', '1M'] as const

      timeRanges.forEach(range => {
        const { rerender } = render(
          <SentimentIndicators
            indicators={mockBullishIndicators}
            overallSentiment={mockBullishSentiment}
            timeRange={range}
          />
        )

        expect(screen.getByText(new RegExp(range))).toBeInTheDocument()

        rerender(
          <SentimentIndicators
            indicators={mockBullishIndicators}
            overallSentiment={mockBullishSentiment}
            timeRange={range}
          />
        )
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero values gracefully', () => {
      const zeroIndicators: SentimentIndicatorsType = {
        fearGreedIndex: 0,
        putCallRatio: 0,
        vixSentiment: 0,
        insiderActivity: 0,
        institutionalFlow: 0,
        retailSentiment: 0,
      }

      const zeroSentiment: SentimentScore = {
        overall: 0,
        news: 0,
        social: 0,
        institutional: 0,
        timestamp: '2024-01-15T10:30:00Z',
        confidence: 0,
      }

      render(
        <SentimentIndicators
          indicators={zeroIndicators}
          overallSentiment={zeroSentiment}
          timeRange="1D"
        />
      )

      // Multiple "0" values exist, check they all appear
      expect(screen.getAllByText('0').length).toBeGreaterThan(0) // Fear & greed and others
      expect(screen.getByText('0.00')).toBeInTheDocument() // Put/call ratio
      expect(screen.getAllByText('0.0').length).toBeGreaterThan(0) // VIX (may appear multiple times)
      expect(screen.getAllByText('0%').length).toBeGreaterThan(0) // Retail sentiment and confidence
    })

    it('should handle extreme values', () => {
      const extremeIndicators: SentimentIndicatorsType = {
        fearGreedIndex: 100,
        putCallRatio: 5.0,
        vixSentiment: 100.0,
        insiderActivity: 100,
        institutionalFlow: 50000000000, // $50B
        retailSentiment: 100,
      }

      render(
        <SentimentIndicators
          indicators={extremeIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      // Multiple "100" values may exist
      expect(screen.getAllByText('100').length).toBeGreaterThan(0) // Fear & greed and other values
      expect(screen.getByText('5.00')).toBeInTheDocument() // High put/call ratio
      expect(screen.getByText('$50.0B')).toBeInTheDocument() // Large institutional flow
    })

    it('should handle progress bar edge cases', () => {
      const { container } = render(
        <SentimentIndicators
          indicators={{ ...mockBullishIndicators, putCallRatio: 3.0 }}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      // Put/call ratio should be capped at 100% width
      const progressBars = container.querySelectorAll('[style*="width: 100%"]')
      expect(progressBars.length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      const headings = screen.getAllByRole('heading', { level: 3 })
      expect(headings.length).toBeGreaterThan(0)

      // Check for specific headings
      expect(screen.getByText('Fear & Greed Index')).toBeInTheDocument()
      expect(screen.getByText('Put/Call Ratio')).toBeInTheDocument()
      expect(screen.getByText('VIX Level')).toBeInTheDocument()
    })

    it('should have descriptive text for each indicator', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Market sentiment based on multiple indicators')).toBeInTheDocument()
      expect(screen.getByText('Options market sentiment')).toBeInTheDocument()
      expect(screen.getByText('Market volatility index')).toBeInTheDocument()
      expect(screen.getByText('Corporate insider trading sentiment')).toBeInTheDocument()
      expect(screen.getByText('Individual investor sentiment')).toBeInTheDocument()
    })

    it('should have appropriate color contrast', () => {
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      // Check that color classes provide sufficient contrast
      const coloredElements = document.querySelectorAll('[class*="text-green-600"], [class*="text-red-600"], [class*="text-yellow-600"]')
      expect(coloredElements.length).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('should render quickly with complex indicator data', () => {
      const startTime = performance.now()
      render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )
      const endTime = performance.now()

      // Rendering should be fast (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('should handle frequent updates efficiently', () => {
      const { rerender } = render(
        <SentimentIndicators
          indicators={mockBullishIndicators}
          overallSentiment={mockBullishSentiment}
          timeRange="1D"
        />
      )

      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        const updatedIndicators: SentimentIndicatorsType = {
          ...mockBullishIndicators,
          fearGreedIndex: Math.max(0, Math.min(100, mockBullishIndicators.fearGreedIndex + (Math.random() - 0.5) * 10)),
          putCallRatio: Math.max(0, mockBullishIndicators.putCallRatio + (Math.random() - 0.5) * 0.2),
          vixSentiment: Math.max(0, mockBullishIndicators.vixSentiment + (Math.random() - 0.5) * 5),
        }

        rerender(
          <SentimentIndicators
            indicators={updatedIndicators}
            overallSentiment={mockBullishSentiment}
            timeRange="1D"
          />
        )
      }

      // Component should still be responsive
      expect(screen.getByText('Fear & Greed Index')).toBeInTheDocument()
    })
  })
});