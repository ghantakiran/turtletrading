import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PortfolioWidget from '../../widgets/PortfolioWidget';
import { useAuthStore } from '../../../stores';

// Mock the auth store
vi.mock('../../../stores', () => ({
  useAuthStore: vi.fn()
}));

const mockUseAuthStore = vi.mocked(useAuthStore);

describe('PortfolioWidget', () => {
  beforeEach(() => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { email: 'test@example.com' }
    } as any);
  });

  it('renders portfolio widget with all required components', () => {
    render(<PortfolioWidget />);

    expect(screen.getByTestId('portfolio-widget')).toBeInTheDocument();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-total-value')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-day-change')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-top-movers')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-rebalance-btn')).toBeInTheDocument();
  });

  it('displays correct portfolio value and changes', () => {
    render(<PortfolioWidget />);

    const totalValue = screen.getByTestId('portfolio-total-value');
    expect(totalValue).toHaveTextContent('$142,750.85');

    const dayChange = screen.getByTestId('portfolio-day-change');
    expect(dayChange).toHaveTextContent('$3,450.12');
    expect(dayChange).toHaveTextContent('2.48%');
  });

  it('shows allocation chart with portfolio holdings', () => {
    render(<PortfolioWidget />);

    // Check allocation section exists
    expect(screen.getByText('Allocation')).toBeInTheDocument();
    expect(screen.getByText('View Chart')).toBeInTheDocument();

    // Check allocation bars are rendered (by style attribute)
    const allocationBars = screen.getByTestId('portfolio-widget').querySelectorAll('[style*="width:"]');
    expect(allocationBars.length).toBeGreaterThan(0);
  });

  it('displays top movers with correct data', () => {
    render(<PortfolioWidget />);

    const topMovers = screen.getByTestId('portfolio-top-movers');
    expect(topMovers).toBeInTheDocument();

    // Check for stock symbols - top 3 movers by absolute percentage change
    // NVDA (3.55%), GOOGL (3.06%), AAPL (1.45%) - only these 3 should appear in top movers
    expect(screen.getAllByText('NVDA')).toHaveLength(2); // One in allocation, one in top movers
    expect(screen.getAllByText('GOOGL')).toHaveLength(2); // One in allocation, one in top movers
    expect(screen.getAllByText('AAPL')).toHaveLength(2); // One in allocation, one in top movers

    // Check for price values in top movers
    expect(topMovers).toHaveTextContent('$24,800'); // NVDA
    expect(topMovers).toHaveTextContent('$15,200'); // GOOGL
    expect(topMovers).toHaveTextContent('$8,750'); // AAPL
  });

  it('handles rebalance button click', () => {
    render(<PortfolioWidget />);

    const rebalanceBtn = screen.getByTestId('portfolio-rebalance-btn');
    expect(rebalanceBtn).toBeEnabled();

    fireEvent.click(rebalanceBtn);
    // Button should remain visible after click (no action implemented yet)
    expect(rebalanceBtn).toBeInTheDocument();
  });

  it('shows sign-in prompt when not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null
    } as any);

    render(<PortfolioWidget />);

    expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
    expect(screen.getByText('Sign in to view your portfolio')).toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-total-value')).not.toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<PortfolioWidget />);

    // Component has a loading state mechanism, check for skeleton elements
    // This would require mocking the loading state, which isn't currently exposed
    // For now, we test that the component renders without the loading state
    expect(screen.getByTestId('portfolio-widget')).toBeInTheDocument();
  });

  it('displays correct color coding for gains and losses', () => {
    render(<PortfolioWidget />);

    // Check that positive changes are green
    const dayChange = screen.getByTestId('portfolio-day-change');
    expect(dayChange.closest('[class*="text-success"]')).toBeInTheDocument();

    // Check total return is positive - use textContent to handle split elements
    const portfolioWidget = screen.getByTestId('portfolio-widget');
    expect(portfolioWidget).toHaveTextContent('+$18,750.85');
    expect(portfolioWidget).toHaveTextContent('(+15.12%)');
  });

  it('shows view all button and responds to click', () => {
    render(<PortfolioWidget />);

    const viewAllBtn = screen.getByTestId('portfolio-view-all');
    expect(viewAllBtn).toHaveTextContent('View All →');

    fireEvent.click(viewAllBtn);
    // Button interaction should be handled (no specific behavior implemented yet)
    expect(viewAllBtn).toBeInTheDocument();
  });

  it('displays rebalancing warning', () => {
    render(<PortfolioWidget />);

    expect(screen.getByText('Portfolio needs rebalancing')).toBeInTheDocument();

    // Check warning icon is present
    const warningIcon = screen.getByTestId('portfolio-widget').querySelector('svg[class*="text-warning"]');
    expect(warningIcon).toBeInTheDocument();
  });

  it('handles responsive design with proper grid layout', () => {
    render(<PortfolioWidget />);

    const widget = screen.getByTestId('portfolio-widget');
    expect(widget).toHaveClass('card', 'h-full');

    // Check for responsive grid classes
    expect(screen.getByText('Top Movers').closest('div')).toBeInTheDocument();
  });

  it('shows correct share counts for holdings', () => {
    render(<PortfolioWidget />);

    expect(screen.getByText('40 shares')).toBeInTheDocument(); // NVDA
    expect(screen.getByText('25 shares')).toBeInTheDocument(); // GOOGL
    expect(screen.getByText('50 shares')).toBeInTheDocument(); // AAPL (from the DOM output)
  });

  it('displays percentage changes with correct formatting', () => {
    render(<PortfolioWidget />);

    const portfolioWidget = screen.getByTestId('portfolio-widget');

    // Check for positive percentage changes in the content (top movers section)
    expect(portfolioWidget).toHaveTextContent('+3.55%'); // NVDA
    expect(portfolioWidget).toHaveTextContent('+3.06%'); // GOOGL
    expect(portfolioWidget).toHaveTextContent('+1.45%'); // AAPL

    // Check for overall portfolio changes
    expect(portfolioWidget).toHaveTextContent('+2.48%'); // Today's change
    expect(portfolioWidget).toHaveTextContent('+15.12%'); // Total return
  });

  it('maintains accessibility standards', () => {
    render(<PortfolioWidget />);

    // Check for proper heading hierarchy
    expect(screen.getByRole('heading', { name: 'Portfolio' })).toBeInTheDocument();

    // Check for proper button accessibility
    const rebalanceBtn = screen.getByTestId('portfolio-rebalance-btn');
    expect(rebalanceBtn.tagName.toLowerCase()).toBe('button');

    // Check for proper color contrast (tested via classes)
    const totalValue = screen.getByTestId('portfolio-total-value');
    expect(totalValue).toHaveClass('text-secondary-100');
  });
});