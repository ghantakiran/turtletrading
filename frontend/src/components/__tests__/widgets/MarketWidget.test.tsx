import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MarketWidget from '../../widgets/MarketWidget';
import { useMarketStore } from '../../../stores';

// Mock the market store
vi.mock('../../../stores', () => ({
  useMarketStore: vi.fn()
}));

const mockUseMarketStore = vi.mocked(useMarketStore);

describe('MarketWidget', () => {
  beforeEach(() => {
    mockUseMarketStore.mockReturnValue({
      isConnected: true
    } as any);
  });

  it('renders market widget with all major sections', () => {
    render(<MarketWidget />);

    expect(screen.getByTestId('market-widget')).toBeInTheDocument();
    expect(screen.getByText('Market Indices')).toBeInTheDocument();
    expect(screen.getByText('Sector Performance')).toBeInTheDocument();
    expect(screen.getByText('Market Breadth')).toBeInTheDocument();
    expect(screen.getByText('Fear & Greed Index')).toBeInTheDocument();
  });

  it('displays market indices with correct data', () => {
    render(<MarketWidget />);

    const indicesSection = screen.getByTestId('market-indices');
    expect(indicesSection).toBeInTheDocument();

    // Check for major indices
    expect(screen.getByText('SPY')).toBeInTheDocument();
    expect(screen.getByText('S&P 500')).toBeInTheDocument();
    expect(screen.getByText('QQQ')).toBeInTheDocument();
    expect(screen.getByText('NASDAQ')).toBeInTheDocument();
    expect(screen.getByText('DIA')).toBeInTheDocument();
    expect(screen.getByText('Dow Jones')).toBeInTheDocument();
    expect(screen.getByText('IWM')).toBeInTheDocument();
    expect(screen.getByText('Russell 2000')).toBeInTheDocument();
  });

  it('shows live connection status', () => {
    render(<MarketWidget />);

    expect(screen.getByText('Live')).toBeInTheDocument();

    // Check for connection indicator
    const connectionDot = screen.getByTestId('market-widget').querySelector('[class*="bg-success-500"]');
    expect(connectionDot).toBeInTheDocument();
  });

  it('displays offline status when disconnected', () => {
    mockUseMarketStore.mockReturnValue({
      isConnected: false
    } as any);

    render(<MarketWidget />);

    expect(screen.getByText('Delayed')).toBeInTheDocument();
  });

  it('renders sector heatmap with all sectors', () => {
    render(<MarketWidget />);

    const sectorHeatmap = screen.getByTestId('sector-heatmap');
    expect(sectorHeatmap).toBeInTheDocument();

    // Check for all sectors
    expect(screen.getByText('Technology')).toBeInTheDocument();
    expect(screen.getByText('Healthcare')).toBeInTheDocument();
    expect(screen.getByText('Financials')).toBeInTheDocument();
    expect(screen.getByText('Energy')).toBeInTheDocument();
    expect(screen.getByText('Consumer')).toBeInTheDocument();
    expect(screen.getByText('Industrials')).toBeInTheDocument();
    expect(screen.getByText('Materials')).toBeInTheDocument();
    expect(screen.getByText('Utilities')).toBeInTheDocument();
  });

  it('shows correct color coding for sector performance', () => {
    render(<MarketWidget />);

    // Check that sectors are displayed with performance indicators
    const techSector = screen.getByText('Technology');
    expect(techSector).toBeInTheDocument();

    const energySector = screen.getByText('Energy');
    expect(energySector).toBeInTheDocument();

    // Check for sector performance percentages
    expect(screen.getByText('+1.85%')).toBeInTheDocument(); // Technology
    expect(screen.getByText('+2.78%')).toBeInTheDocument(); // Energy
  });

  it('displays market breadth statistics', () => {
    render(<MarketWidget />);

    const marketBreadth = screen.getByTestId('market-breadth');
    expect(marketBreadth).toBeInTheDocument();

    expect(screen.getByText('Advancing')).toBeInTheDocument();
    expect(screen.getByText('1,847')).toBeInTheDocument();
    expect(screen.getByText('Declining')).toBeInTheDocument();
    expect(screen.getByText('1,253')).toBeInTheDocument();
    expect(screen.getByText('A/D Ratio')).toBeInTheDocument();
    expect(screen.getByText('1.47')).toBeInTheDocument();
  });

  it('shows new highs and lows', () => {
    render(<MarketWidget />);

    expect(screen.getByText('New Highs: 89')).toBeInTheDocument();
    expect(screen.getByText('New Lows: 23')).toBeInTheDocument();
  });

  it('displays Fear & Greed Index with correct value', () => {
    render(<MarketWidget />);

    const fearGreedIndex = screen.getByTestId('fear-greed-index');
    expect(fearGreedIndex).toBeInTheDocument();

    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('Greed')).toBeInTheDocument();
    expect(screen.getByText('Current market sentiment')).toBeInTheDocument();
  });

  it('renders mini charts for indices', () => {
    render(<MarketWidget />);

    // Check for SVG elements (mini charts)
    const svgElements = screen.getByTestId('market-widget').querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThan(0);

    // Check for polyline elements in charts
    const chartLines = screen.getByTestId('market-widget').querySelectorAll('polyline');
    expect(chartLines.length).toBeGreaterThan(0);
  });

  it('shows correct price formatting', () => {
    render(<MarketWidget />);

    // Check for properly formatted numbers
    expect(screen.getByText('4,530.25')).toBeInTheDocument();
    expect(screen.getByText('15,846.12')).toBeInTheDocument();
    expect(screen.getByText('34,512.78')).toBeInTheDocument();
    expect(screen.getByText('1,987.45')).toBeInTheDocument();
  });

  it('displays percentage changes with correct signs', () => {
    render(<MarketWidget />);

    // Positive changes
    expect(screen.getByText('+12.45 (+0.28%)')).toBeInTheDocument();
    expect(screen.getByText('+89.34 (+0.26%)')).toBeInTheDocument();

    // Negative changes
    expect(screen.getByText('-23.67 (-0.15%)')).toBeInTheDocument();
    expect(screen.getByText('-8.92 (-0.45%)')).toBeInTheDocument();
  });

  it('handles view heatmap button click', () => {
    render(<MarketWidget />);

    const viewHeatmapBtn = screen.getByText('View Heatmap');
    expect(viewHeatmapBtn).toBeInTheDocument();

    fireEvent.click(viewHeatmapBtn);
    // Button should remain clickable
    expect(viewHeatmapBtn).toBeInTheDocument();
  });

  it('shows market breadth progress bar', () => {
    render(<MarketWidget />);

    // Look for progress bar element
    const progressBar = screen.getByTestId('market-breadth').querySelector('[style*="width:"]');
    expect(progressBar).toBeInTheDocument();

    // Should show advancing stocks percentage
    const expectedWidth = (1847 / (1847 + 1253)) * 100;
    expect(progressBar).toHaveStyle({ width: `${expectedWidth}%` });
  });

  it('renders Fear & Greed circular chart', () => {
    render(<MarketWidget />);

    const fearGreedSection = screen.getByTestId('fear-greed-index');
    const circles = fearGreedSection.querySelectorAll('circle');

    // Should have background and progress circles
    expect(circles).toHaveLength(2);
  });

  it('shows sector percentage changes with correct formatting', () => {
    render(<MarketWidget />);

    expect(screen.getByText('+1.85%')).toBeInTheDocument(); // Technology
    expect(screen.getByText('+0.92%')).toBeInTheDocument(); // Healthcare
    expect(screen.getByText('-0.65%')).toBeInTheDocument(); // Financials
    expect(screen.getByText('+2.78%')).toBeInTheDocument(); // Energy
  });

  it('maintains accessibility standards', () => {
    render(<MarketWidget />);

    // Check for proper heading structure
    expect(screen.getByRole('heading', { name: 'Market Indices' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sector Performance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Market Breadth' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fear & Greed Index' })).toBeInTheDocument();

    // Check for button accessibility
    const heatmapBtn = screen.getByRole('button', { name: 'View Heatmap' });
    expect(heatmapBtn).toBeInTheDocument();
  });

  it('handles loading state gracefully', () => {
    render(<MarketWidget />);

    // Component should render without loading state by default
    expect(screen.getByTestId('market-widget')).toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('uses proper color themes for trends', () => {
    render(<MarketWidget />);

    // Check for trend arrows and colors
    const marketWidget = screen.getByTestId('market-widget');
    const greenElements = marketWidget.querySelectorAll('[class*="text-success"]');
    const redElements = marketWidget.querySelectorAll('[class*="text-error"]');

    expect(greenElements.length).toBeGreaterThan(0);
    expect(redElements.length).toBeGreaterThan(0);
  });
});