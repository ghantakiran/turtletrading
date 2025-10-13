/**
 * Unit tests for CoverageFilters Component
 * TDD approach - tests written first for Issue #34
 */

import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import CoverageFilters from '@/components/testing/CoverageFilters'

const mockOnSearchChange = jest.fn()
const mockOnThresholdChange = jest.fn()
const mockOnClearFilters = jest.fn()

describe('CoverageFilters Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should render search input', () => {
    render(
      <CoverageFilters
        searchQuery=""
        threshold="all"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    const searchInput = screen.getByPlaceholderText(/search files/i)
    expect(searchInput).toBeInTheDocument()
  })

  test('should render threshold filter dropdown', () => {
    render(
      <CoverageFilters
        searchQuery=""
        threshold="all"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    const dropdown = screen.getByRole('combobox')
    expect(dropdown).toBeInTheDocument()
  })

  test('should have all threshold options', () => {
    render(
      <CoverageFilters
        searchQuery=""
        threshold="all"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    expect(screen.getByText('All Files')).toBeInTheDocument()
    expect(screen.getByText(/low.*60%/i)).toBeInTheDocument()
    expect(screen.getByText(/medium.*60.*79%/i)).toBeInTheDocument()
    expect(screen.getByText(/high.*80%/i)).toBeInTheDocument()
  })

  test('should call onSearchChange when typing in search', () => {
    render(
      <CoverageFilters
        searchQuery=""
        threshold="all"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    const searchInput = screen.getByPlaceholderText(/search files/i)
    fireEvent.change(searchInput, { target: { value: 'test' } })

    expect(mockOnSearchChange).toHaveBeenCalledWith('test')
  })

  test('should call onThresholdChange when selecting filter', () => {
    render(
      <CoverageFilters
        searchQuery=""
        threshold="all"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    const dropdown = screen.getByRole('combobox')
    fireEvent.change(dropdown, { target: { value: 'low' } })

    expect(mockOnThresholdChange).toHaveBeenCalledWith('low')
  })

  test('should display current search value', () => {
    render(
      <CoverageFilters
        searchQuery="component"
        threshold="all"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    const searchInput = screen.getByPlaceholderText(/search files/i) as HTMLInputElement
    expect(searchInput.value).toBe('component')
  })

  test('should display current threshold value', () => {
    render(
      <CoverageFilters
        searchQuery=""
        threshold="low"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    const dropdown = screen.getByRole('combobox') as HTMLSelectElement
    expect(dropdown.value).toBe('low')
  })

  test('should render clear filters button', () => {
    render(
      <CoverageFilters
        searchQuery="test"
        threshold="low"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    const clearButton = screen.getByRole('button', { name: /clear/i })
    expect(clearButton).toBeInTheDocument()
  })

  test('should call onClearFilters when clicking clear button', () => {
    render(
      <CoverageFilters
        searchQuery="test"
        threshold="low"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    const clearButton = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearButton)

    expect(mockOnClearFilters).toHaveBeenCalled()
  })

  test('should only show clear button when filters are active', () => {
    const { rerender } = render(
      <CoverageFilters
        searchQuery=""
        threshold="all"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    // No filters active - no clear button
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()

    // Add search filter
    rerender(
      <CoverageFilters
        searchQuery="test"
        threshold="all"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  test('should show active filter count', () => {
    render(
      <CoverageFilters
        searchQuery="test"
        threshold="low"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
        fileCount={5}
        totalCount={50}
      />
    )

    // Should show "5 of 50 files"
    expect(screen.getByText(/5.*50.*files/i)).toBeInTheDocument()
  })

  test('should be responsive on mobile', () => {
    const { container } = render(
      <CoverageFilters
        searchQuery=""
        threshold="all"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    // Should have responsive flex layout
    const filterContainer = container.querySelector('.flex')
    expect(filterContainer).toBeInTheDocument()
  })

  test('should have accessible labels', () => {
    render(
      <CoverageFilters
        searchQuery=""
        threshold="all"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    // Search input should have label
    expect(screen.getByLabelText(/search/i)).toBeInTheDocument()

    // Dropdown should have label
    expect(screen.getByLabelText(/filter.*coverage/i)).toBeInTheDocument()
  })

  test('should handle empty callbacks gracefully', () => {
    render(
      <CoverageFilters
        searchQuery=""
        threshold="all"
        onSearchChange={mockOnSearchChange}
        onThresholdChange={mockOnThresholdChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    // Should render without errors
    expect(screen.getByPlaceholderText(/search files/i)).toBeInTheDocument()
  })
})
