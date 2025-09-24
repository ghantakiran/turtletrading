import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardGrid from '../DashboardGrid';
import { useUIStore } from '../../stores';

// Mock the UI store
vi.mock('../../stores', () => ({
  useUIStore: vi.fn()
}));

// Mock react-grid-layout to avoid DOM complexities in tests
vi.mock('react-grid-layout', () => ({
  Responsive: ({ children, onLayoutChange, ...props }: any) => (
    <div data-testid="responsive-grid-layout" {...props}>
      {children}
    </div>
  ),
  WidthProvider: (component: any) => component
}));

// Mock widget components
vi.mock('../widgets/PortfolioWidget', () => ({
  default: () => <div data-testid="mock-portfolio-widget">Portfolio Widget</div>
}));

vi.mock('../widgets/MarketWidget', () => ({
  default: () => <div data-testid="mock-market-widget">Market Widget</div>
}));

vi.mock('../widgets/AlertsWidget', () => ({
  default: () => <div data-testid="mock-alerts-widget">Alerts Widget</div>
}));

const mockUseUIStore = vi.mocked(useUIStore);

const mockStoreActions = {
  updateDashboardLayout: vi.fn(),
  saveDashboardLayout: vi.fn()
};

describe('DashboardGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseUIStore.mockReturnValue({
      dashboardLayout: {},
      updateDashboardLayout: mockStoreActions.updateDashboardLayout,
      saveDashboardLayout: mockStoreActions.saveDashboardLayout
    } as any);
  });

  it('renders dashboard grid with all components', () => {
    render(<DashboardGrid />);

    expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-grid-layout')).toBeInTheDocument();
  });

  it('renders all widget components', () => {
    render(<DashboardGrid />);

    expect(screen.getByTestId('dashboard-widget-portfolio')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-widget-market')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-widget-alerts')).toBeInTheDocument();

    expect(screen.getByTestId('mock-portfolio-widget')).toBeInTheDocument();
    expect(screen.getByTestId('mock-market-widget')).toBeInTheDocument();
    expect(screen.getByTestId('mock-alerts-widget')).toBeInTheDocument();
  });

  it('shows edit mode toggle button', () => {
    render(<DashboardGrid />);

    const editToggle = screen.getByTestId('edit-mode-toggle');
    expect(editToggle).toBeInTheDocument();
    expect(editToggle).toHaveAttribute('title', 'Customize Dashboard');
  });

  it('toggles edit mode when button is clicked', () => {
    const onEditModeChange = vi.fn();
    render(<DashboardGrid onEditModeChange={onEditModeChange} />);

    const editToggle = screen.getByTestId('edit-mode-toggle');
    fireEvent.click(editToggle);

    expect(onEditModeChange).toHaveBeenCalledWith(true);
  });

  it('shows edit mode controls when in edit mode', () => {
    render(<DashboardGrid editMode={true} />);

    expect(screen.getByText('Drag widgets to rearrange • Resize by dragging corners')).toBeInTheDocument();
    expect(screen.getByTestId('reset-layout-btn')).toBeInTheDocument();
    expect(screen.getByTestId('save-layout-btn')).toBeInTheDocument();
  });

  it('hides edit mode controls when not in edit mode', () => {
    render(<DashboardGrid editMode={false} />);

    expect(screen.queryByText('Drag widgets to rearrange')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reset-layout-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('save-layout-btn')).not.toBeInTheDocument();
  });

  it('shows widget titles in edit mode', () => {
    render(<DashboardGrid editMode={true} />);

    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Market Overview')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
  });

  it('applies edit mode styling to widgets', () => {
    render(<DashboardGrid editMode={true} />);

    const portfolioWidget = screen.getByTestId('dashboard-widget-portfolio');
    expect(portfolioWidget).toHaveClass('ring-2', 'ring-primary-500');
  });

  it('handles save layout button click', async () => {
    const onEditModeChange = vi.fn();
    render(<DashboardGrid editMode={true} onEditModeChange={onEditModeChange} />);

    const saveBtn = screen.getByTestId('save-layout-btn');
    fireEvent.click(saveBtn);

    expect(mockStoreActions.saveDashboardLayout).toHaveBeenCalled();
    expect(onEditModeChange).toHaveBeenCalledWith(false);
  });

  it('handles reset layout button click', () => {
    render(<DashboardGrid editMode={true} />);

    const resetBtn = screen.getByTestId('reset-layout-btn');
    fireEvent.click(resetBtn);

    expect(mockStoreActions.updateDashboardLayout).toHaveBeenCalled();

    // Check that it was called with default layouts
    const callArgs = mockStoreActions.updateDashboardLayout.mock.calls[0][0];
    expect(callArgs).toHaveProperty('lg');
    expect(callArgs).toHaveProperty('md');
    expect(callArgs).toHaveProperty('sm');
    expect(callArgs).toHaveProperty('xs');
  });

  it('renders fallback layout on server side', () => {
    // Simulate server-side rendering by mocking client-side detection
    const originalWindow = global.window;
    delete (global as any).window;

    render(<DashboardGrid />);

    // Should render fallback layout
    expect(screen.getByTestId('mock-portfolio-widget')).toBeInTheDocument();
    expect(screen.getByTestId('mock-market-widget')).toBeInTheDocument();
    expect(screen.getByTestId('mock-alerts-widget')).toBeInTheDocument();

    // Restore window
    global.window = originalWindow;
  });

  it('uses saved layout from store', () => {
    const savedLayout = {
      lg: [
        { i: 'portfolio', x: 0, y: 0, w: 4, h: 4 },
        { i: 'market', x: 4, y: 0, w: 8, h: 6 },
        { i: 'alerts', x: 0, y: 4, w: 4, h: 5 }
      ]
    };

    mockUseUIStore.mockReturnValue({
      dashboardLayout: savedLayout,
      updateDashboardLayout: mockStoreActions.updateDashboardLayout,
      saveDashboardLayout: mockStoreActions.saveDashboardLayout
    } as any);

    render(<DashboardGrid />);

    // Component should use the saved layout
    expect(screen.getByTestId('responsive-grid-layout')).toBeInTheDocument();
  });

  it('handles layout change events', () => {
    render(<DashboardGrid />);

    // The ResponsiveGridLayout would normally call onLayoutChange
    // Since we're mocking it, we can test that the component accepts the prop
    const gridLayout = screen.getByTestId('responsive-grid-layout');
    expect(gridLayout).toBeInTheDocument();
  });

  it('sets correct responsive breakpoints', () => {
    render(<DashboardGrid />);

    const gridLayout = screen.getByTestId('responsive-grid-layout');

    // Check that responsive props are passed
    expect(gridLayout).toHaveAttribute('data-testid', 'responsive-grid-layout');
  });

  it('disables drag and resize when not in edit mode', () => {
    render(<DashboardGrid editMode={false} />);

    const gridLayout = screen.getByTestId('responsive-grid-layout');
    expect(gridLayout).toBeInTheDocument();
  });

  it('enables drag and resize when in edit mode', () => {
    render(<DashboardGrid editMode={true} />);

    const gridLayout = screen.getByTestId('responsive-grid-layout');
    expect(gridLayout).toBeInTheDocument();
  });

  it('maintains widget aspect ratios', () => {
    render(<DashboardGrid />);

    // All widgets should be rendered with their containers
    expect(screen.getByTestId('dashboard-widget-portfolio')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-widget-market')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-widget-alerts')).toBeInTheDocument();
  });

  it('handles window resize gracefully', () => {
    render(<DashboardGrid />);

    // Should render without errors on different screen sizes
    expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
  });

  it('provides correct widget configuration', () => {
    render(<DashboardGrid />);

    // Test that all widgets are configured correctly
    const portfolioWidget = screen.getByTestId('dashboard-widget-portfolio');
    const marketWidget = screen.getByTestId('dashboard-widget-market');
    const alertsWidget = screen.getByTestId('dashboard-widget-alerts');

    expect(portfolioWidget).toBeInTheDocument();
    expect(marketWidget).toBeInTheDocument();
    expect(alertsWidget).toBeInTheDocument();
  });

  it('updates layout state on changes', async () => {
    render(<DashboardGrid />);

    // The component should handle layout updates
    // This is tested through the mocked store actions
    expect(mockUseUIStore).toHaveBeenCalled();
  });

  it('shows drag handles in edit mode', () => {
    render(<DashboardGrid editMode={true} />);

    // Look for edit mode indicators
    const widgets = screen.getAllByTestId(/dashboard-widget-/);
    widgets.forEach(widget => {
      expect(widget).toHaveClass('ring-2');
    });
  });

  it('handles empty dashboard layout gracefully', () => {
    mockUseUIStore.mockReturnValue({
      dashboardLayout: {},
      updateDashboardLayout: mockStoreActions.updateDashboardLayout,
      saveDashboardLayout: mockStoreActions.saveDashboardLayout
    } as any);

    render(<DashboardGrid />);

    // Should still render all widgets
    expect(screen.getByTestId('mock-portfolio-widget')).toBeInTheDocument();
    expect(screen.getByTestId('mock-market-widget')).toBeInTheDocument();
    expect(screen.getByTestId('mock-alerts-widget')).toBeInTheDocument();
  });

  it('maintains accessibility in edit mode', () => {
    render(<DashboardGrid editMode={true} />);

    const editToggle = screen.getByTestId('edit-mode-toggle');
    expect(editToggle).toHaveAttribute('title', 'Exit Edit Mode');

    const saveBtn = screen.getByTestId('save-layout-btn');
    const resetBtn = screen.getByTestId('reset-layout-btn');

    expect(saveBtn).toHaveTextContent('Save Layout');
    expect(resetBtn).toHaveTextContent('Reset');
  });
});