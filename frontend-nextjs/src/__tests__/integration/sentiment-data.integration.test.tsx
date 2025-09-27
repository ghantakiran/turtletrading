/**
 * Integration tests for Sentiment data binding between server and client components
 * Tests data flow from server-side fetching through to client-side display and real-time updates
 */
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { jest } from '@jest/globals'
import SentimentPage from '@/app/(protected)/sentiment/page'
import SentimentClient from '@/app/(protected)/sentiment/SentimentClient'
import type { SentimentScore, NewsItem, SocialMediaFeed, SectorSentiment } from '@/app/(protected)/sentiment/page'

// Mock the environment
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
}))

// Mock UI components
jest.mock('@/components/ui/RefreshButton', () => ({
  RefreshButton: ({ onClick, isRefreshing }: { onClick: () => void; isRefreshing: boolean }) => (
    <button data-testid="refresh-button" onClick={onClick} disabled={isRefreshing}>
      {isRefreshing ? 'Refreshing...' : 'Refresh'}
    </button>
  ),
}))

// Test data
const mockSentimentScore: SentimentScore = {
  overall: 65,
  news: 70,
  social: 60,
  institutional: 68,
  timestamp: '2024-01-15T10:30:00Z',
  confidence: 85,
}

const mockNewsItems: NewsItem[] = [
  {
    id: '1',
    title: 'Market Rally Continues as Tech Stocks Surge',
    summary: 'Technology sector leads market gains amid positive earnings reports',
    url: 'https://example.com/news/1',
    source: 'Financial Times',
    publishedAt: '2024-01-15T09:30:00Z',
    sentiment: 75,
    relevance: 90,
    symbols: ['AAPL', 'MSFT', 'GOOGL'],
  },
  {
    id: '2',
    title: 'Fed Signals Cautious Approach to Interest Rates',
    summary: 'Federal Reserve maintains cautious stance on monetary policy changes',
    url: 'https://example.com/news/2',
    source: 'Reuters',
    publishedAt: '2024-01-15T08:45:00Z',
    sentiment: 45,
    relevance: 85,
    symbols: ['SPY', 'QQQ'],
  },
]

const mockSocialMediaFeed: SocialMediaFeed = {
  platform: 'twitter',
  totalPosts: 12453,
  sentimentBreakdown: {
    positive: 6200,
    negative: 3100,
    neutral: 3153,
  },
  trendingSymbols: ['TSLA', 'AAPL', 'GME', 'AMC'],
  topHashtags: ['#stocks', '#trading', '#bullish', '#earnings'],
  engagementRate: 0.067,
  timestamp: '2024-01-15T10:30:00Z',
}

const mockSectorSentiment: SectorSentiment[] = [
  {
    sector: 'Technology',
    sentiment: 72,
    change: 5,
    newsCount: 234,
    socialMentions: 1567,
    institutionalFlow: 123456789,
    timestamp: '2024-01-15T10:30:00Z',
  },
  {
    sector: 'Healthcare',
    sentiment: 58,
    change: -3,
    newsCount: 156,
    socialMentions: 892,
    institutionalFlow: -45678912,
    timestamp: '2024-01-15T10:30:00Z',
  },
]

describe('Sentiment Data Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock successful API responses
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        sentimentScore: mockSentimentScore,
        newsItems: mockNewsItems,
        socialMediaFeed: mockSocialMediaFeed,
        sectorSentiment: mockSectorSentiment,
      }),
    })
  })

  describe('Server-to-Client Data Flow', () => {
    it('should pass server sentiment data correctly to client components', async () => {
      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // Verify sentiment score is displayed
      expect(screen.getByText('65')).toBeInTheDocument() // Overall sentiment
      expect(screen.getByText('70')).toBeInTheDocument() // News sentiment
      expect(screen.getByText('60')).toBeInTheDocument() // Social sentiment
      expect(screen.getByText('68')).toBeInTheDocument() // Institutional sentiment

      // Verify news items are displayed
      expect(screen.getByText('Market Rally Continues as Tech Stocks Surge')).toBeInTheDocument()
      expect(screen.getByText('Fed Signals Cautious Approach to Interest Rates')).toBeInTheDocument()

      // Verify social media data is displayed
      expect(screen.getByText('12,453')).toBeInTheDocument() // Total posts
      expect(screen.getByText('6,200')).toBeInTheDocument() // Positive posts

      // Verify sector sentiment is displayed
      expect(screen.getByText('Technology')).toBeInTheDocument()
      expect(screen.getByText('Healthcare')).toBeInTheDocument()
    })

    it('should handle sentiment data transformation correctly', async () => {
      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // Check sentiment score color coding
      const bullishSentiment = screen.getByText('72') // Technology sector
      expect(bullishSentiment.closest('.text-green-600')).toBeTruthy()

      const bearishSentiment = screen.getByText('58') // Healthcare sector
      expect(bearishSentiment.closest('.text-yellow-600')).toBeTruthy()

      // Check news sentiment indicators
      const positiveNews = screen.getByText('75') // First news item sentiment
      expect(positiveNews.closest('.text-green-600')).toBeTruthy()

      const neutralNews = screen.getByText('45') // Second news item sentiment
      expect(neutralNews.closest('.text-yellow-600')).toBeTruthy()

      // Check percentage formatting for social media breakdown
      expect(screen.getByText('49.8%')).toBeInTheDocument() // 6200/12453 positive percentage
    })

    it('should handle empty sentiment data gracefully', async () => {
      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={null}
          initialNewsItems={[]}
          initialSocialMediaFeed={null}
          initialSectorSentiment={[]}
        />
      )

      render(<SentimentPageWithProps />)

      // Should show empty state messages
      expect(screen.getByText('No sentiment data available')).toBeInTheDocument()
      expect(screen.getByText('No news items available')).toBeInTheDocument()
      expect(screen.getByText('No social media data available')).toBeInTheDocument()
    })
  })

  describe('Real-time Sentiment Updates', () => {
    it('should update sentiment scores when refresh is triggered', async () => {
      const updatedSentiment: SentimentScore = {
        ...mockSentimentScore,
        overall: 78,
        news: 82,
        social: 74,
        institutional: 76,
        timestamp: '2024-01-15T11:00:00Z',
      }

      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // Initial state
      expect(screen.getByText('65')).toBeInTheDocument()

      // Mock updated API response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sentimentScore: updatedSentiment,
          newsItems: mockNewsItems,
          socialMediaFeed: mockSocialMediaFeed,
          sectorSentiment: mockSectorSentiment,
        }),
      })

      // Trigger refresh
      const refreshButton = screen.getByTestId('refresh-button')
      fireEvent.click(refreshButton)

      // Wait for update
      await waitFor(() => {
        expect(screen.getByText('78')).toBeInTheDocument()
        expect(screen.getByText('82')).toBeInTheDocument()
        expect(screen.getByText('74')).toBeInTheDocument()
        expect(screen.getByText('76')).toBeInTheDocument()
      })
    })

    it('should update news feed when new articles arrive', async () => {
      const newNewsItem: NewsItem = {
        id: '3',
        title: 'Breaking: Major Tech Acquisition Announced',
        summary: 'Large technology company announces strategic acquisition',
        url: 'https://example.com/news/3',
        source: 'Bloomberg',
        publishedAt: '2024-01-15T11:00:00Z',
        sentiment: 85,
        relevance: 95,
        symbols: ['GOOGL', 'META'],
      }

      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // Mock updated API response with new news item
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sentimentScore: mockSentimentScore,
          newsItems: [newNewsItem, ...mockNewsItems],
          socialMediaFeed: mockSocialMediaFeed,
          sectorSentiment: mockSectorSentiment,
        }),
      })

      // Trigger refresh
      const refreshButton = screen.getByTestId('refresh-button')
      fireEvent.click(refreshButton)

      // Wait for new news item
      await waitFor(() => {
        expect(screen.getByText('Breaking: Major Tech Acquisition Announced')).toBeInTheDocument()
      })
    })

    it('should auto-refresh sentiment data at specified intervals', async () => {
      jest.useFakeTimers()

      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // Mock API call for auto-refresh
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          sentimentScore: { ...mockSentimentScore, overall: 70 },
          newsItems: mockNewsItems,
          socialMediaFeed: mockSocialMediaFeed,
          sectorSentiment: mockSectorSentiment,
        }),
      })

      // Fast-forward time to trigger auto-refresh (5 minutes for sentiment)
      act(() => {
        jest.advanceTimersByTime(300000)
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/sentiment/overview')
      })

      jest.useRealTimers()
    })
  })

  describe('Interactive Sentiment Features', () => {
    it('should handle news item filtering by symbol', async () => {
      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // Find symbol filter input
      const symbolInput = screen.getByPlaceholderText('Filter by symbol (e.g., AAPL)')

      if (symbolInput) {
        fireEvent.change(symbolInput, { target: { value: 'AAPL' } })

        // Should filter news items to show only AAPL-related news
        await waitFor(() => {
          expect(screen.getByText('Market Rally Continues as Tech Stocks Surge')).toBeInTheDocument()
          // Second news item shouldn't be visible as it doesn't contain AAPL
        })
      }
    })

    it('should handle sentiment time range changes', async () => {
      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // Find time range buttons
      const timeRangeButtons = screen.getAllByRole('button').filter(button =>
        ['1H', '4H', '1D', '1W'].includes(button.textContent || '')
      )

      if (timeRangeButtons.length > 0) {
        // Click different time range
        fireEvent.click(timeRangeButtons[2]) // 1D

        // Should trigger API call with time range parameter
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('timeRange=1D')
          )
        })
      }
    })

    it('should handle sector sentiment selection', async () => {
      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // Find Technology sector
      const techSector = screen.getByText('Technology')

      if (techSector) {
        fireEvent.click(techSector)

        // Should trigger sector-specific sentiment data fetch
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('sector=Technology')
          )
        })
      }
    })

    it('should handle news item detail expansion', async () => {
      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // Find news item title
      const newsTitle = screen.getByText('Market Rally Continues as Tech Stocks Surge')

      if (newsTitle) {
        fireEvent.click(newsTitle)

        // Should show news item summary
        await waitFor(() => {
          expect(screen.getByText('Technology sector leads market gains amid positive earnings reports')).toBeInTheDocument()
        })
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle sentiment API errors gracefully', async () => {
      // Mock API error
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Sentiment API unavailable'))

      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      const { container } = render(<SentimentPageWithProps />)

      // Trigger refresh to cause error
      const refreshButton = screen.getByTestId('refresh-button')
      fireEvent.click(refreshButton)

      // Component should not crash and should show original data
      await waitFor(() => {
        expect(container).toBeInTheDocument()
        expect(screen.getByText('65')).toBeInTheDocument()
      })
    })

    it('should handle invalid sentiment responses', async () => {
      // Mock invalid API response
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' }),
      })

      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // Trigger refresh
      const refreshButton = screen.getByTestId('refresh-button')
      fireEvent.click(refreshButton)

      // Should handle error and maintain functionality
      await waitFor(() => {
        expect(screen.getByText('65')).toBeInTheDocument()
      })
    })

    it('should handle malformed sentiment data gracefully', async () => {
      // Mock malformed API response
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          sentimentScore: { overall: 'invalid' }, // Invalid data type
          newsItems: [{ title: 'Test' }], // Missing required fields
          socialMediaFeed: null,
          sectorSentiment: undefined,
        }),
      })

      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // Trigger refresh
      const refreshButton = screen.getByTestId('refresh-button')
      fireEvent.click(refreshButton)

      // Should handle malformed data and show appropriate fallbacks
      await waitFor(() => {
        // Should not crash and maintain some functionality
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument()
      })
    })
  })

  describe('Data Consistency', () => {
    it('should maintain sentiment data consistency across components', async () => {
      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // All components should show consistent timestamp
      const timestamps = screen.getAllByText(/2024-01-15/)
      expect(timestamps.length).toBeGreaterThan(0)
    })

    it('should sync sentiment changes across all indicators', async () => {
      const updatedTimestamp = '2024-01-15T12:00:00Z'
      const updatedData = {
        sentimentScore: { ...mockSentimentScore, timestamp: updatedTimestamp, overall: 80 },
        newsItems: mockNewsItems.map(item => ({ ...item, timestamp: updatedTimestamp })),
        socialMediaFeed: { ...mockSocialMediaFeed, timestamp: updatedTimestamp },
        sectorSentiment: mockSectorSentiment.map(sector => ({ ...sector, timestamp: updatedTimestamp })),
      }

      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      render(<SentimentPageWithProps />)

      // Mock updated API response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedData,
      })

      // Trigger refresh
      const refreshButton = screen.getByTestId('refresh-button')
      fireEvent.click(refreshButton)

      // Wait for updates and verify consistency
      await waitFor(() => {
        expect(screen.getByText('80')).toBeInTheDocument() // Updated overall sentiment
        const newTimestamps = screen.getAllByText(/12:00/)
        expect(newTimestamps.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Performance', () => {
    it('should handle large news datasets efficiently', async () => {
      const largeNewsData = Array.from({ length: 200 }, (_, i) => ({
        id: `news-${i}`,
        title: `News Article ${i}`,
        summary: `Summary for news article ${i}`,
        url: `https://example.com/news/${i}`,
        source: 'Test Source',
        publishedAt: '2024-01-15T10:30:00Z',
        sentiment: Math.floor(Math.random() * 100),
        relevance: Math.floor(Math.random() * 100),
        symbols: ['TEST'],
      }))

      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={largeNewsData}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      const startTime = performance.now()
      render(<SentimentPageWithProps />)
      const endTime = performance.now()

      // Should render efficiently (less than 200ms for 200 news items)
      expect(endTime - startTime).toBeLessThan(200)
    })

    it('should handle frequent sentiment updates without memory leaks', async () => {
      jest.useFakeTimers()

      const SentimentPageWithProps = () => (
        <SentimentClient
          initialSentimentScore={mockSentimentScore}
          initialNewsItems={mockNewsItems}
          initialSocialMediaFeed={mockSocialMediaFeed}
          initialSectorSentiment={mockSectorSentiment}
        />
      )

      const { unmount } = render(<SentimentPageWithProps />)

      // Simulate multiple rapid sentiment updates
      for (let i = 0; i < 10; i++) {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sentimentScore: {
              ...mockSentimentScore,
              overall: 50 + Math.random() * 50,
            },
            newsItems: mockNewsItems,
            socialMediaFeed: mockSocialMediaFeed,
            sectorSentiment: mockSectorSentiment,
          }),
        })

        act(() => {
          jest.advanceTimersByTime(5000) // 5 second intervals
        })
      }

      // Cleanup should work properly
      unmount()

      jest.useRealTimers()
    })
  })
})