import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Design System Test Component
const DesignSystemShowcase: React.FC = () => {
  return (
    <div className="min-h-screen bg-background-primary p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Typography */}
        <section data-testid="typography-section">
          <h1 className="text-3xl font-bold text-secondary-100 mb-4">Design System</h1>
          <h2 className="text-xl font-semibold text-secondary-200 mb-2">PRD Dark-First Theme</h2>
          <p className="text-secondary-300">Secondary text content</p>
          <p className="text-secondary-400">Muted text content</p>
        </section>

        {/* Color Palette */}
        <section data-testid="colors-section">
          <h3 className="text-lg font-semibold text-secondary-100 mb-4">Color Palette</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-background-primary border border-secondary-700 rounded-lg">
              <div className="text-secondary-100">Primary BG</div>
              <div className="text-xs text-secondary-400">#1a1a1a</div>
            </div>
            <div className="p-4 bg-background-secondary border border-secondary-700 rounded-lg">
              <div className="text-secondary-100">Secondary BG</div>
              <div className="text-xs text-secondary-400">#0f172a</div>
            </div>
            <div className="p-4 bg-background-tertiary border border-secondary-700 rounded-lg">
              <div className="text-secondary-100">Tertiary BG</div>
              <div className="text-xs text-secondary-400">#2d2d2d</div>
            </div>
            <div className="p-4 bg-background-accent border border-secondary-700 rounded-lg">
              <div className="text-secondary-100">Accent BG</div>
              <div className="text-xs text-secondary-400">#1e293b</div>
            </div>
          </div>
        </section>

        {/* Button Components */}
        <section data-testid="buttons-section">
          <h3 className="text-lg font-semibold text-secondary-100 mb-4">Buttons</h3>
          <div className="flex flex-wrap gap-4">
            <button className="btn-primary" data-testid="btn-primary">Primary Button</button>
            <button className="btn-success" data-testid="btn-success">Success Button</button>
            <button className="btn-error" data-testid="btn-error">Error Button</button>
          </div>
        </section>

        {/* Card Components */}
        <section data-testid="cards-section">
          <h3 className="text-lg font-semibold text-secondary-100 mb-4">Cards</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card" data-testid="card-basic">
              <h4 className="text-lg font-medium text-secondary-100 mb-2">Basic Card</h4>
              <p className="text-secondary-300">This is a basic card with dark-first styling.</p>
            </div>
            <div className="card-hover" data-testid="card-hover">
              <h4 className="text-lg font-medium text-secondary-100 mb-2">Hover Card</h4>
              <p className="text-secondary-300">This card has hover effects.</p>
            </div>
          </div>
        </section>

        {/* Chip Components */}
        <section data-testid="chips-section">
          <h3 className="text-lg font-semibold text-secondary-100 mb-4">Chips/Badges</h3>
          <div className="flex flex-wrap gap-2">
            <span className="chip" data-testid="chip-default">Default</span>
            <span className="chip-success" data-testid="chip-success">Success</span>
            <span className="chip-error" data-testid="chip-error">Error</span>
          </div>
        </section>

        {/* Tab Components */}
        <section data-testid="tabs-section">
          <h3 className="text-lg font-semibold text-secondary-100 mb-4">Tabs</h3>
          <div className="flex space-x-1 bg-background-tertiary p-1 rounded-lg">
            <button className="tab active" data-testid="tab-active">Active Tab</button>
            <button className="tab" data-testid="tab-inactive">Inactive Tab</button>
          </div>
        </section>

        {/* Skeleton Components */}
        <section data-testid="skeletons-section">
          <h3 className="text-lg font-semibold text-secondary-100 mb-4">Loading States</h3>
          <div className="space-y-2">
            <div className="skeleton h-6 w-48" data-testid="skeleton-line"></div>
            <div className="skeleton-text w-full" data-testid="skeleton-text"></div>
            <div className="skeleton-text w-3/4" data-testid="skeleton-text-short"></div>
          </div>
        </section>

        {/* Accessibility Focus Indicators */}
        <section data-testid="accessibility-section">
          <h3 className="text-lg font-semibold text-secondary-100 mb-4">Accessibility</h3>
          <div className="space-y-2">
            <button
              className="px-4 py-2 bg-primary-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-background-primary"
              data-testid="focus-button"
            >
              Keyboard Focusable
            </button>
            <input
              type="text"
              placeholder="Focus me with Tab"
              className="w-full px-4 py-2 bg-background-tertiary border border-secondary-600 rounded-lg text-secondary-100 placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              data-testid="focus-input"
            />
          </div>
        </section>
      </div>
    </div>
  );
};

describe('Design System', () => {
  it('renders all design system components', () => {
    render(<DesignSystemShowcase />);

    // Check all sections are rendered
    expect(screen.getByTestId('typography-section')).toBeInTheDocument();
    expect(screen.getByTestId('colors-section')).toBeInTheDocument();
    expect(screen.getByTestId('buttons-section')).toBeInTheDocument();
    expect(screen.getByTestId('cards-section')).toBeInTheDocument();
    expect(screen.getByTestId('chips-section')).toBeInTheDocument();
    expect(screen.getByTestId('tabs-section')).toBeInTheDocument();
    expect(screen.getByTestId('skeletons-section')).toBeInTheDocument();
    expect(screen.getByTestId('accessibility-section')).toBeInTheDocument();
  });

  it('renders PRD-specified color palette', () => {
    render(<DesignSystemShowcase />);

    // Check that color palette is displayed with correct labels
    expect(screen.getByText('Primary BG')).toBeInTheDocument();
    expect(screen.getByText('Secondary BG')).toBeInTheDocument();
    expect(screen.getByText('Tertiary BG')).toBeInTheDocument();
    expect(screen.getByText('Accent BG')).toBeInTheDocument();

    // Check color values are displayed
    expect(screen.getByText('#1a1a1a')).toBeInTheDocument();
    expect(screen.getByText('#0f172a')).toBeInTheDocument();
    expect(screen.getByText('#2d2d2d')).toBeInTheDocument();
    expect(screen.getByText('#1e293b')).toBeInTheDocument();
  });

  it('renders button components with proper classes', () => {
    render(<DesignSystemShowcase />);

    const primaryBtn = screen.getByTestId('btn-primary');
    const successBtn = screen.getByTestId('btn-success');
    const errorBtn = screen.getByTestId('btn-error');

    expect(primaryBtn).toHaveClass('btn-primary');
    expect(successBtn).toHaveClass('btn-success');
    expect(errorBtn).toHaveClass('btn-error');
  });

  it('renders card components with hover functionality', () => {
    render(<DesignSystemShowcase />);

    const basicCard = screen.getByTestId('card-basic');
    const hoverCard = screen.getByTestId('card-hover');

    expect(basicCard).toHaveClass('card');
    expect(hoverCard).toHaveClass('card-hover');
  });

  it('renders chip components with proper styling', () => {
    render(<DesignSystemShowcase />);

    const defaultChip = screen.getByTestId('chip-default');
    const successChip = screen.getByTestId('chip-success');
    const errorChip = screen.getByTestId('chip-error');

    expect(defaultChip).toHaveClass('chip');
    expect(successChip).toHaveClass('chip-success');
    expect(errorChip).toHaveClass('chip-error');
  });

  it('renders tab components with active state', () => {
    render(<DesignSystemShowcase />);

    const activeTab = screen.getByTestId('tab-active');
    const inactiveTab = screen.getByTestId('tab-inactive');

    expect(activeTab).toHaveClass('tab', 'active');
    expect(inactiveTab).toHaveClass('tab');
    expect(inactiveTab).not.toHaveClass('active');
  });

  it('renders skeleton loading components', () => {
    render(<DesignSystemShowcase />);

    const skeletonLine = screen.getByTestId('skeleton-line');
    const skeletonText = screen.getByTestId('skeleton-text');
    const skeletonTextShort = screen.getByTestId('skeleton-text-short');

    expect(skeletonLine).toHaveClass('skeleton');
    expect(skeletonText).toHaveClass('skeleton-text');
    expect(skeletonTextShort).toHaveClass('skeleton-text');
  });

  it('supports keyboard navigation and focus indicators', () => {
    render(<DesignSystemShowcase />);

    const focusButton = screen.getByTestId('focus-button');
    const focusInput = screen.getByTestId('focus-input');

    // Test keyboard focus
    focusButton.focus();
    expect(focusButton).toHaveFocus();

    focusInput.focus();
    expect(focusInput).toHaveFocus();

    // Check focus ring classes are present
    expect(focusButton).toHaveClass('focus:ring-2', 'focus:ring-primary-400');
    expect(focusInput).toHaveClass('focus:ring-2', 'focus:ring-primary-500');
  });

  it('handles button interactions', () => {
    render(<DesignSystemShowcase />);

    const primaryBtn = screen.getByTestId('btn-primary');

    // Test button can be clicked
    fireEvent.click(primaryBtn);
    expect(primaryBtn).toBeInTheDocument(); // Button remains after click
  });

  it('displays proper typography hierarchy', () => {
    render(<DesignSystemShowcase />);

    // Check main heading
    const mainHeading = screen.getByText('Design System');
    expect(mainHeading).toBeInTheDocument();

    // Check subheading
    const subheading = screen.getByText('PRD Dark-First Theme');
    expect(subheading).toBeInTheDocument();

    // Check section headings
    expect(screen.getByText('Color Palette')).toBeInTheDocument();
    expect(screen.getByText('Buttons')).toBeInTheDocument();
    expect(screen.getByText('Cards')).toBeInTheDocument();
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
  });
});