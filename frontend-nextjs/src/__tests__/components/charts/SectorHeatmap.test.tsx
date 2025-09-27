/**
 * Unit tests for SectorHeatmap chart component
 * Tests sector visualization, interactive heatmap, and performance metrics
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import { SectorHeatmap } from '@/app/(protected)/market/components/SectorHeatmap'
import type { SectorData } from '@/app/(protected)/market/page'

// Mock data for testing
const mockSectors: SectorData[] = [
  {
    sector: 'Technology',
    change: 150000000,
    changePercent: 2.45,
    marketCap: 12500000000000,
    volume: 2500000000,
    topStocks: [
      { symbol: 'AAPL', change: 5.25, changePercent: 3.2 },
      { symbol: 'MSFT', change: 8.15, changePercent: 2.8 },
      { symbol: 'GOOGL', change: -2.30, changePercent: -1.1 },
    ],
  },
  {
    sector: 'Healthcare',
    change: -85000000,
    changePercent: -1.25,
    marketCap: 8900000000000,
    volume: 1800000000,
    topStocks: [
      { symbol: 'JNJ', change: -2.45, changePercent: -1.5 },
      { symbol: 'PFE', change: 1.20, changePercent: 2.1 },
      { symbol: 'UNH', change: -5.85, changePercent: -1.8 },
    ],
  },
  {
    sector: 'Financials',
    change: 95000000,
    changePercent: 0.75,
    marketCap: 6700000000000,
    volume: 3200000000,
    topStocks: [
      { symbol: 'JPM', change: 3.45, changePercent: 2.2 },
      { symbol: 'BAC', change: 0.85, changePercent: 2.8 },
      { symbol: 'WFC', change: -1.25, changePercent: -2.1 },
    ],
  },
  {
    sector: 'Energy',
    change: -220000000,
    changePercent: -4.85,
    marketCap: 3200000000000,
    volume: 1950000000,
    topStocks: [
      { symbol: 'XOM', change: -8.25, changePercent: -5.2 },
      { symbol: 'CVX', change: -6.45, changePercent: -4.1 },
      { symbol: 'COP', change: -12.80, changePercent: -6.8 },
    ],
  },
]

describe('SectorHeatmap Component', () => {
  const mockOnSectorSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render sector heatmap with all sectors', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Check if header is rendered
      expect(screen.getByText('Sector Performance')).toBeInTheDocument()
      expect(screen.getByText(/Click on a sector to view detailed analysis/)).toBeInTheDocument()

      // Check if all sectors are rendered
      expect(screen.getByText('Technology')).toBeInTheDocument()
      expect(screen.getByText('Healthcare')).toBeInTheDocument()
      expect(screen.getByText('Financials')).toBeInTheDocument()
      expect(screen.getByText('Energy')).toBeInTheDocument()
    })

    it('should display sector performance percentages correctly', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Check positive percentage formatting
      expect(screen.getByText('+2.45%')).toBeInTheDocument()
      expect(screen.getByText('+0.75%')).toBeInTheDocument()

      // Check negative percentage formatting
      expect(screen.getByText('-1.25%')).toBeInTheDocument()
      expect(screen.getByText('-4.85%')).toBeInTheDocument()
    })

    it('should display formatted market cap values', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Check market cap formatting
      expect(screen.getByText('$12.5T')).toBeInTheDocument()
      expect(screen.getByText('$8.9T')).toBeInTheDocument()
      expect(screen.getByText('$6.7T')).toBeInTheDocument()
      expect(screen.getByText('$3.2T')).toBeInTheDocument()
    })

    it('should display formatted volume values', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Check volume formatting in table
      expect(screen.getByText('2.5B')).toBeInTheDocument()
      expect(screen.getByText('1.8B')).toBeInTheDocument()
      expect(screen.getByText('3.2B')).toBeInTheDocument()
      expect(screen.getByText('2.0B')).toBeInTheDocument()
    })

    it('should render performance legend', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Performance Scale')).toBeInTheDocument()
      expect(screen.getByText('-3%+')).toBeInTheDocument()
      expect(screen.getByText('+3%+')).toBeInTheDocument()
    })

    it('should render sector details table', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Check table headers
      expect(screen.getByText('Sector')).toBeInTheDocument()
      expect(screen.getByText('Change')).toBeInTheDocument()
      expect(screen.getByText('Market Cap')).toBeInTheDocument()
      expect(screen.getByText('Volume')).toBeInTheDocument()
      expect(screen.getByText('Top Stocks')).toBeInTheDocument()
    })
  })

  describe('Performance Color Coding', () => {
    it('should apply correct color classes based on performance', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Technology (+2.45%) should have green background
      const techSector = screen.getByText('Technology').closest('div')
      expect(techSector).toHaveClass('bg-green-400')

      // Energy (-4.85%) should have red background
      const energySector = screen.getByText('Energy').closest('div')
      expect(energySector).toHaveClass('bg-red-600')

      // Healthcare (-1.25%) should have red background
      const healthcareSector = screen.getByText('Healthcare').closest('div')
      expect(healthcareSector).toHaveClass('bg-red-400')
    })

    it('should use appropriate text colors for readability', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Energy (-4.85%) should have white text for dark background
      const energyText = screen.getByText('Energy').closest('div')
      expect(energyText).toHaveClass('text-white')

      // Financials (+0.75%) should have dark text for light background
      const financialsText = screen.getByText('Financials').closest('div')
      expect(financialsText).toHaveClass('text-gray-900')
    })
  })

  describe('Sector Selection', () => {
    it('should call onSectorSelect when sector is clicked', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      const techSector = screen.getByText('Technology').closest('div')
      fireEvent.click(techSector!)

      expect(mockOnSectorSelect).toHaveBeenCalledWith('Technology')
    })

    it('should show selected sector with ring styling', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector="Technology"
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      const techSector = screen.getByText('Technology').closest('div')
      expect(techSector).toHaveClass('ring-4', 'ring-blue-500', 'ring-opacity-50')
    })

    it('should deselect sector when clicked again', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector="Technology"
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      const techSector = screen.getByText('Technology').closest('div')
      fireEvent.click(techSector!)

      expect(mockOnSectorSelect).toHaveBeenCalledWith(null)
    })

    it('should highlight selected sector in table', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector="Healthcare"
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Find Healthcare row in table
      const tableRows = screen.getAllByText('Healthcare')
      const tableRow = tableRows.find(el => el.closest('tr'))?.closest('tr')
      expect(tableRow).toHaveClass('bg-blue-50')
    })

    it('should show sector details when sector is selected', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector="Technology"
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Check if selected sector details are shown
      expect(screen.getByText('Technology - Top Performers')).toBeInTheDocument()
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('MSFT')).toBeInTheDocument()
      expect(screen.getByText('GOOGL')).toBeInTheDocument()
    })

    it('should allow closing sector details', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector="Technology"
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      const closeButton = screen.getByRole('button')
      fireEvent.click(closeButton)

      expect(mockOnSectorSelect).toHaveBeenCalledWith(null)
    })
  })

  describe('Top Stocks Display', () => {
    it('should display top stocks in table with performance indicators', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Check if top stocks are displayed (only first 3)
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('MSFT')).toBeInTheDocument()
      expect(screen.getByText('GOOGL')).toBeInTheDocument()
    })

    it('should show color-coded performance for top stocks', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // AAPL should have green background (positive change)
      const aaplBadge = screen.getByText('AAPL')
      expect(aaplBadge).toHaveClass('bg-green-100', 'text-green-800')

      // GOOGL should have red background (negative change)
      const googlBadge = screen.getByText('GOOGL')
      expect(googlBadge).toHaveClass('bg-red-100', 'text-red-800')
    })

    it('should display detailed stock performance in selected sector view', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector="Technology"
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Check detailed stock performance
      expect(screen.getByText('+3.20%')).toBeInTheDocument() // AAPL
      expect(screen.getByText('+2.80%')).toBeInTheDocument() // MSFT
      expect(screen.getByText('-1.10%')).toBeInTheDocument() // GOOGL
    })
  })

  describe('Data Sorting', () => {
    it('should sort sectors by performance (best to worst)', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      const sectorElements = screen.getAllByText(/^[+-]?\d+\.\d+%$/)

      // Should be sorted: +2.45%, +0.75%, -1.25%, -4.85%
      expect(sectorElements[0]).toHaveTextContent('+2.45%') // Technology
      expect(sectorElements[1]).toHaveTextContent('+0.75%') // Financials
      expect(sectorElements[2]).toHaveTextContent('-1.25%') // Healthcare
      expect(sectorElements[3]).toHaveTextContent('-4.85%') // Energy
    })
  })

  describe('Time Range Display', () => {
    it('should display time range in header', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1W"
        />
      )

      expect(screen.getByText(/1W performance/)).toBeInTheDocument()
    })

    it('should handle different time ranges', () => {
      const timeRanges = ['1D', '1W', '1M', '3M', '1Y'] as const

      timeRanges.forEach(range => {
        const { rerender } = render(
          <SectorHeatmap
            sectors={mockSectors}
            selectedSector={null}
            onSectorSelect={mockOnSectorSelect}
            timeRange={range}
          />
        )

        expect(screen.getByText(new RegExp(`${range} performance`))).toBeInTheDocument()

        rerender(
          <SectorHeatmap
            sectors={mockSectors}
            selectedSector={null}
            onSectorSelect={mockOnSectorSelect}
            timeRange={range}
          />
        )
      })
    })
  })

  describe('Empty State', () => {
    it('should handle empty sectors array gracefully', () => {
      render(
        <SectorHeatmap
          sectors={[]}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Component should still render header
      expect(screen.getByText('Sector Performance')).toBeInTheDocument()

      // Table should still be present but empty
      expect(screen.getByText('Sector')).toBeInTheDocument()
      expect(screen.getByText('Change')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing sector data gracefully', () => {
      const incompleteSectors: SectorData[] = [
        {
          sector: 'Test Sector',
          change: 0,
          changePercent: 0,
          marketCap: 1000000000,
          volume: 1000000,
          topStocks: [],
        },
      ]

      render(
        <SectorHeatmap
          sectors={incompleteSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Test Sector')).toBeInTheDocument()
      expect(screen.getByText('0.00%')).toBeInTheDocument()
    })

    it('should handle sectors with no top stocks', () => {
      const sectorsWithoutStocks: SectorData[] = [
        {
          sector: 'Empty Sector',
          change: 100000000,
          changePercent: 1.5,
          marketCap: 5000000000000,
          volume: 1000000000,
          topStocks: [],
        },
      ]

      render(
        <SectorHeatmap
          sectors={sectorsWithoutStocks}
          selectedSector="Empty Sector"
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      expect(screen.getByText('Empty Sector - Top Performers')).toBeInTheDocument()
      // Should not crash when trying to display top stocks
    })
  })

  describe('Interactions', () => {
    it('should handle hover effects on heatmap tiles', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      const techSector = screen.getByText('Technology').closest('div')
      expect(techSector).toHaveClass('hover:scale-105')
    })

    it('should handle hover effects on table rows', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Find table rows
      const tableRows = document.querySelectorAll('tbody tr')
      expect(tableRows[0]).toHaveClass('hover:bg-gray-50')
    })

    it('should handle keyboard navigation', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      const techSector = screen.getByText('Technology').closest('div')

      // Test keyboard interaction
      fireEvent.keyDown(techSector!, { key: 'Enter', code: 'Enter' })
      fireEvent.keyDown(techSector!, { key: ' ', code: 'Space' })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and semantic structure', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Check for semantic table structure
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getAllByRole('columnheader')).toHaveLength(5)
      expect(screen.getAllByRole('row')).toHaveLength(5) // 1 header + 4 data rows
    })

    it('should provide sector name as title for truncated text', () => {
      render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      const techSectorTitle = screen.getByTitle('Technology')
      expect(techSectorTitle).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 50 }, (_, i) => ({
        sector: `Sector ${i}`,
        change: (Math.random() - 0.5) * 200000000,
        changePercent: (Math.random() - 0.5) * 10,
        marketCap: Math.random() * 10000000000000,
        volume: Math.random() * 5000000000,
        topStocks: Array.from({ length: 5 }, (_, j) => ({
          symbol: `STK${i}${j}`,
          change: (Math.random() - 0.5) * 10,
          changePercent: (Math.random() - 0.5) * 5,
        })),
      }))

      const startTime = performance.now()
      render(
        <SectorHeatmap
          sectors={largeDataset}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )
      const endTime = performance.now()

      // Rendering should be fast (less than 200ms for 50 sectors)
      expect(endTime - startTime).toBeLessThan(200)
    })

    it('should handle frequent updates efficiently', () => {
      const { rerender } = render(
        <SectorHeatmap
          sectors={mockSectors}
          selectedSector={null}
          onSectorSelect={mockOnSectorSelect}
          timeRange="1D"
        />
      )

      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        const updatedSectors = mockSectors.map(sector => ({
          ...sector,
          changePercent: sector.changePercent + Math.random() - 0.5,
          change: sector.change + (Math.random() - 0.5) * 10000000,
        }))

        rerender(
          <SectorHeatmap
            sectors={updatedSectors}
            selectedSector={null}
            onSectorSelect={mockOnSectorSelect}
            timeRange="1D"
          />
        )
      }

      // Component should still be responsive
      expect(screen.getByText('Technology')).toBeInTheDocument()
    })
  })
});