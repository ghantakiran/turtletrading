import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AlertsWidget from '../../widgets/AlertsWidget';

describe('AlertsWidget', () => {
  it('renders alerts widget with all major components', () => {
    render(<AlertsWidget />);

    expect(screen.getByTestId('alerts-widget')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByTestId('alerts-kpis')).toBeInTheDocument();
    expect(screen.getByTestId('alert-categories')).toBeInTheDocument();
    expect(screen.getByTestId('priority-filters')).toBeInTheDocument();
    expect(screen.getByTestId('alerts-list')).toBeInTheDocument();
  });

  it('displays correct KPI metrics', () => {
    render(<AlertsWidget />);

    const kpisSection = screen.getByTestId('alerts-kpis');

    expect(within(kpisSection).getByText('5')).toBeInTheDocument(); // Total
    expect(within(kpisSection).getByText('3')).toBeInTheDocument(); // Active
    expect(within(kpisSection).getByText('2')).toBeInTheDocument(); // Today
    expect(within(kpisSection).getByText('87.5%')).toBeInTheDocument(); // Accuracy
    expect(within(kpisSection).getByText('2.3s')).toBeInTheDocument(); // Avg Time

    // Check KPI labels
    expect(within(kpisSection).getByText('Total')).toBeInTheDocument();
    expect(within(kpisSection).getByText('Active')).toBeInTheDocument();
    expect(within(kpisSection).getByText('Today')).toBeInTheDocument();
    expect(within(kpisSection).getByText('Accuracy')).toBeInTheDocument();
    expect(within(kpisSection).getByText('Avg Time')).toBeInTheDocument();
  });

  it('shows all alert categories with correct counts', () => {
    render(<AlertsWidget />);

    const categoriesSection = screen.getByTestId('alert-categories');

    expect(within(categoriesSection).getByText('All (5)')).toBeInTheDocument();
    expect(within(categoriesSection).getByText('Price (1)')).toBeInTheDocument();
    expect(within(categoriesSection).getByText('Technical (1)')).toBeInTheDocument();
    expect(within(categoriesSection).getByText('Volume (1)')).toBeInTheDocument();
    expect(within(categoriesSection).getByText('News (1)')).toBeInTheDocument();
    expect(within(categoriesSection).getByText('Sentiment (1)')).toBeInTheDocument();
  });

  it('displays priority filters', () => {
    render(<AlertsWidget />);

    const prioritySection = screen.getByTestId('priority-filters');

    expect(within(prioritySection).getByText('All')).toBeInTheDocument();
    expect(within(prioritySection).getByText('Critical')).toBeInTheDocument();
    expect(within(prioritySection).getByText('High')).toBeInTheDocument();
    expect(within(prioritySection).getByText('Medium')).toBeInTheDocument();
    expect(within(prioritySection).getByText('Low')).toBeInTheDocument();
  });

  it('filters alerts by category', () => {
    render(<AlertsWidget />);

    // Initially shows all alerts
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.getByText('NVDA')).toBeInTheDocument();

    // Click on Price category
    fireEvent.click(screen.getByText('Price (1)'));

    // Should only show price alerts
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByText('TSLA')).not.toBeInTheDocument();
  });

  it('filters alerts by priority', () => {
    render(<AlertsWidget />);

    // Click on Critical priority
    fireEvent.click(screen.getByText('Critical'));

    // Should only show critical alerts
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
  });

  it('displays alert details correctly', () => {
    render(<AlertsWidget />);

    const alertsList = screen.getByTestId('alerts-list');

    // Check for alert symbols
    expect(within(alertsList).getByText('AAPL')).toBeInTheDocument();
    expect(within(alertsList).getByText('TSLA')).toBeInTheDocument();
    expect(within(alertsList).getByText('NVDA')).toBeInTheDocument();

    // Check for alert messages
    expect(within(alertsList).getByText('AAPL price target $240.00 reached')).toBeInTheDocument();
    expect(within(alertsList).getByText('TSLA RSI indicates oversold condition')).toBeInTheDocument();
    expect(within(alertsList).getByText('NVDA unusual volume activity detected')).toBeInTheDocument();
  });

  it('shows correct priority chips with proper styling', () => {
    render(<AlertsWidget />);

    // Check for priority chips in priority filter buttons
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();

    // Check for priority chips in alert items (uppercase)
    expect(screen.getByText('HIGH')).toBeInTheDocument(); // 1 high priority alert
    expect(screen.getAllByText('MEDIUM')).toHaveLength(2); // 2 medium priority alerts
    expect(screen.getByText('CRITICAL')).toBeInTheDocument(); // 1 critical priority alert
    expect(screen.getByText('LOW')).toBeInTheDocument(); // 1 low priority alert

    // Critical should be prominent
    const criticalChip = screen.getByText('CRITICAL');
    expect(criticalChip).toHaveClass('animate-pulse');
  });

  it('displays triggered vs monitoring status correctly', () => {
    render (<AlertsWidget />);

    // Check for triggered status
    expect(screen.getAllByText('Triggered')).toHaveLength(2);

    // Check for monitoring status
    expect(screen.getAllByText('Monitoring')).toHaveLength(3);

    // Check for spinning icon on monitoring alerts
    const monitoringElements = screen.getAllByText('Monitoring');
    expect(monitoringElements.length).toBeGreaterThan(0);

    // Check that monitoring status elements exist
    monitoringElements.forEach(element => {
      expect(element).toBeInTheDocument();
    });
  });

  it('shows edit and delete buttons for each alert', () => {
    render(<AlertsWidget />);

    // Should have edit and delete buttons for each alert
    const editButtons = screen.getAllByText('Edit');
    const deleteButtons = screen.getAllByText('Delete');

    expect(editButtons).toHaveLength(5);
    expect(deleteButtons).toHaveLength(5);

    // Delete buttons should have error styling
    deleteButtons.forEach(button => {
      expect(button).toHaveClass('text-error-400');
    });
  });

  it('displays trigger timestamps for triggered alerts', () => {
    render(<AlertsWidget />);

    // Check for "Triggered at" text for triggered alerts
    const triggeredElements = screen.getAllByText(/Triggered/);
    expect(triggeredElements.length).toBeGreaterThan(0);

    // Check that we have timestamps in AM/PM format
    const alertsList = screen.getByTestId('alerts-list');
    const timestampPattern = /\d{1,2}:\d{2}\s?(AM|PM)/;

    expect(alertsList.textContent).toMatch(timestampPattern);
  });

  it('shows type icons for different alert types', () => {
    render(<AlertsWidget />);

    const alertsList = screen.getByTestId('alerts-list');

    // Check that alerts contain emoji icons (this tests the getTypeIcon function)
    expect(alertsList.textContent).toContain('💰'); // Price
    expect(alertsList.textContent).toContain('📊'); // Technical
    expect(alertsList.textContent).toContain('📈'); // Volume
    expect(alertsList.textContent).toContain('📰'); // News
    expect(alertsList.textContent).toContain('😊'); // Sentiment
  });

  it('handles create new alert button', () => {
    render(<AlertsWidget />);

    const createBtn = screen.getByTestId('alerts-create-new');
    expect(createBtn).toHaveTextContent('+ New Alert');

    fireEvent.click(createBtn);
    expect(createBtn).toBeInTheDocument();
  });

  it('handles view history button', () => {
    render(<AlertsWidget />);

    const historyBtn = screen.getByTestId('alerts-view-history');
    expect(historyBtn).toHaveTextContent('View Alert History');

    fireEvent.click(historyBtn);
    expect(historyBtn).toBeInTheDocument();
  });

  it('handles manage all button', () => {
    render(<AlertsWidget />);

    const manageBtn = screen.getByTestId('alerts-manage-all');
    expect(manageBtn).toHaveTextContent('Manage All');

    fireEvent.click(manageBtn);
    expect(manageBtn).toBeInTheDocument();
  });

  it('shows empty state when no alerts match filters', () => {
    render(<AlertsWidget />);

    // Filter by a combination that yields no results
    fireEvent.click(screen.getByText('Price (1)'));
    fireEvent.click(screen.getByText('Critical'));

    // Should show empty state
    expect(screen.getByText('No alerts match your filters')).toBeInTheDocument();

    // Should show empty state icon
    const emptyStateIcon = screen.getByTestId('alerts-list').querySelector('svg');
    expect(emptyStateIcon).toBeInTheDocument();
  });

  it('combines category and priority filters correctly', () => {
    render(<AlertsWidget />);

    // Filter by Technical and Medium priority
    fireEvent.click(screen.getByText('Technical (1)'));
    fireEvent.click(screen.getByText('Medium'));

    // Should show only TSLA alert
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    expect(screen.queryByText('NVDA')).not.toBeInTheDocument();
  });

  it('displays alert conditions and values', () => {
    render(<AlertsWidget />);

    const alertsList = screen.getByTestId('alerts-list');

    // Check for condition displays in the alerts list content
    expect(alertsList).toHaveTextContent('above');
    expect(alertsList).toHaveTextContent('RSI oversold');
    expect(alertsList).toHaveTextContent('volume spike');

    // Check for value patterns in the content - they may be split across elements
    expect(alertsList).toHaveTextContent('235.5');
    expect(alertsList).toHaveTextContent('240');
    expect(alertsList).toHaveTextContent('28.5');
    expect(alertsList).toHaveTextContent('30');
    expect(alertsList).toHaveTextContent('2.5M');
    expect(alertsList).toHaveTextContent('2.0M');
  });

  it('maintains accessibility standards', () => {
    render(<AlertsWidget />);

    // Check for proper heading
    expect(screen.getByRole('heading', { name: 'Alerts' })).toBeInTheDocument();

    // Check for proper button roles
    expect(screen.getByRole('button', { name: '+ New Alert' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage All' })).toBeInTheDocument();

    // Check for proper list structure
    const alertsList = screen.getByTestId('alerts-list');
    expect(alertsList).toBeInTheDocument();
  });

  it('formats time correctly', () => {
    render(<AlertsWidget />);

    // Time should be formatted properly - check for presence of AM/PM formatted times
    const timeRegex = /\d{1,2}:\d{2}\s?(AM|PM)/;
    const alertsList = screen.getByTestId('alerts-list');
    const timeElements = alertsList.querySelectorAll('span');

    let hasFormattedTimes = false;
    timeElements.forEach(element => {
      if (timeRegex.test(element.textContent || '')) {
        hasFormattedTimes = true;
      }
    });

    expect(hasFormattedTimes).toBe(true);
  });
});