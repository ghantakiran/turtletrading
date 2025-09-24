import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from '../../pages/Dashboard';

// Mock all dependencies
vi.mock('../DashboardGrid', () => ({
  default: ({ editMode, onEditModeChange }: any) => (
    <div data-testid="mock-dashboard-grid">
      <div>Edit Mode: {editMode ? 'ON' : 'OFF'}</div>
      <button onClick={() => onEditModeChange(!editMode)} data-testid="mock-edit-toggle">
        Toggle Edit
      </button>
    </div>
  )
}));

describe('Dashboard Integration', () => {
  it('renders dashboard with all major components', () => {
    render(<Dashboard />);

    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Monitor your portfolio and market trends')).toBeInTheDocument();
    expect(screen.getByTestId('mock-dashboard-grid')).toBeInTheDocument();
  });

  it('shows portfolio balance in header', () => {
    render(<Dashboard />);

    expect(screen.getByText('$142,750.85')).toBeInTheDocument();
    expect(screen.getByText('+$3,450.12 (2.48%)')).toBeInTheDocument();
  });

  it('manages edit mode state correctly', () => {
    render(<Dashboard />);

    // Initially edit mode should be off
    expect(screen.getByText('Edit Mode: OFF')).toBeInTheDocument();

    // Toggle edit mode
    fireEvent.click(screen.getByTestId('mock-edit-toggle'));

    // Edit mode should now be on
    expect(screen.getByText('Edit Mode: ON')).toBeInTheDocument();

    // Toggle back
    fireEvent.click(screen.getByTestId('mock-edit-toggle'));

    // Edit mode should be off again
    expect(screen.getByText('Edit Mode: OFF')).toBeInTheDocument();
  });

  it('passes edit mode state to dashboard grid', () => {
    render(<Dashboard />);

    const dashboardGrid = screen.getByTestId('mock-dashboard-grid');
    expect(dashboardGrid).toBeInTheDocument();

    // Check initial state
    expect(screen.getByText('Edit Mode: OFF')).toBeInTheDocument();
  });

  it('maintains consistent layout structure', () => {
    render(<Dashboard />);

    // Check for main container
    const dashboard = screen.getByTestId('dashboard');
    expect(dashboard).toHaveClass('space-y-6');

    // Check header structure
    expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Monitor your portfolio and market trends')).toBeInTheDocument();
  });

  it('displays financial data with proper formatting', () => {
    render(<Dashboard />);

    // Check currency formatting
    expect(screen.getByText('$142,750.85')).toBeInTheDocument();
    expect(screen.getByText('+$3,450.12 (2.48%)')).toBeInTheDocument();
  });

  it('handles dashboard grid interactions', async () => {
    render(<Dashboard />);

    // Test edit mode toggle through grid component
    const mockEditToggle = screen.getByTestId('mock-edit-toggle');

    fireEvent.click(mockEditToggle);
    await waitFor(() => {
      expect(screen.getByText('Edit Mode: ON')).toBeInTheDocument();
    });

    fireEvent.click(mockEditToggle);
    await waitFor(() => {
      expect(screen.getByText('Edit Mode: OFF')).toBeInTheDocument();
    });
  });

  it('renders without errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<Dashboard />);

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('maintains proper component hierarchy', () => {
    render(<Dashboard />);

    // Check that dashboard contains grid
    const dashboard = screen.getByTestId('dashboard');
    const grid = screen.getByTestId('mock-dashboard-grid');

    expect(dashboard).toContainElement(grid);
  });

  it('handles state updates correctly', () => {
    render(<Dashboard />);

    let currentState = false;

    // Simulate state changes
    const toggleButton = screen.getByTestId('mock-edit-toggle');

    fireEvent.click(toggleButton);
    currentState = true;
    expect(screen.getByText('Edit Mode: ON')).toBeInTheDocument();

    fireEvent.click(toggleButton);
    currentState = false;
    expect(screen.getByText('Edit Mode: OFF')).toBeInTheDocument();
  });

  it('provides accessible navigation', () => {
    render(<Dashboard />);

    // Check for proper heading structure
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Trading Dashboard');
  });

  it('displays consistent branding', () => {
    render(<Dashboard />);

    expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Monitor your portfolio and market trends')).toBeInTheDocument();
  });
});