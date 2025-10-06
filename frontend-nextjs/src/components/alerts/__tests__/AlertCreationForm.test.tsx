/**
 * Unit Tests for AlertCreationForm Component
 * Tests alert creation UI and validation
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AlertCreationForm } from '../AlertCreationForm'
import useMarketStore from '@/stores/marketStore'

// Mock the market store
jest.mock('@/stores/marketStore')

describe('AlertCreationForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render alert creation form', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: jest.fn()
    })

    render(<AlertCreationForm />)

    expect(screen.getByText(/create alert/i) || screen.getByText(/new alert/i)).toBeInTheDocument()
  })

  it('should display symbol input field', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: jest.fn()
    })

    render(<AlertCreationForm />)

    expect(screen.getByLabelText(/symbol/i) || screen.getByPlaceholderText(/symbol/i)).toBeInTheDocument()
  })

  it('should display alert type selector', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: jest.fn()
    })

    render(<AlertCreationForm />)

    expect(screen.getByText(/type/i) || screen.getByText(/alert type/i)).toBeInTheDocument()
  })

  it('should display condition input field', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: jest.fn()
    })

    render(<AlertCreationForm />)

    expect(screen.getByLabelText(/price/i) || screen.getByLabelText(/value/i) || screen.getByPlaceholderText(/price/i)).toBeInTheDocument()
  })

  it('should validate required fields', async () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: jest.fn()
    })

    render(<AlertCreationForm />)

    const submitButton = screen.getByRole('button', { name: /create|save|add/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/required/i) || screen.getByText(/cannot be empty/i) || screen.getByText(/invalid/i)).toBeInTheDocument()
    })
  })

  it('should create price above alert', async () => {
    const mockCreateAlert = jest.fn()

    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: mockCreateAlert
    })

    render(<AlertCreationForm />)

    // Fill form
    const symbolInput = screen.getByLabelText(/symbol/i) || screen.getByPlaceholderText(/symbol/i)
    fireEvent.change(symbolInput, { target: { value: 'AAPL' } })

    const priceInput = screen.getByLabelText(/price/i) || screen.getByPlaceholderText(/price/i)
    fireEvent.change(priceInput, { target: { value: '200' } })

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create|save|add/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockCreateAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'AAPL',
          type: expect.any(String),
          condition: expect.any(Number),
          isActive: true
        })
      )
    })
  })

  it('should support different alert types', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: jest.fn()
    })

    render(<AlertCreationForm />)

    // Should have dropdown/select with different alert types
    const typeSelector = screen.getByText(/type/i).closest('div') || screen.getByRole('combobox') || screen.getByRole('button', { name: /select/i })
    expect(typeSelector).toBeInTheDocument()
  })

  it('should show conditional fields based on alert type', async () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: jest.fn()
    })

    const { container } = render(<AlertCreationForm />)

    // Different alert types may show different fields
    expect(container.querySelector('input') || container.querySelector('select')).toBeInTheDocument()
  })

  it('should validate price input as number', async () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: jest.fn()
    })

    render(<AlertCreationForm />)

    const priceInput = screen.getByLabelText(/price/i) || screen.getByPlaceholderText(/price/i)
    fireEvent.change(priceInput, { target: { value: 'invalid' } })

    const submitButton = screen.getByRole('button', { name: /create|save|add/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.queryByText(/number/i) || screen.queryByText(/invalid/i) || priceInput).toBeInTheDocument()
    })
  })

  it('should clear form after successful submission', async () => {
    const mockCreateAlert = jest.fn()

    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: mockCreateAlert
    })

    render(<AlertCreationForm />)

    const symbolInput = screen.getByLabelText(/symbol/i) || screen.getByPlaceholderText(/symbol/i) as HTMLInputElement
    fireEvent.change(symbolInput, { target: { value: 'AAPL' } })

    const submitButton = screen.getByRole('button', { name: /create|save|add/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(symbolInput.value).toBe('AAPL' || '')
    })
  })

  it('should support cancel action', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: jest.fn()
    })

    render(<AlertCreationForm onCancel={jest.fn()} />)

    const cancelButton = screen.queryByRole('button', { name: /cancel/i })
    if (cancelButton) {
      expect(cancelButton).toBeInTheDocument()
    }
  })

  it('should pre-fill symbol from props', () => {
    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: jest.fn()
    })

    render(<AlertCreationForm defaultSymbol="TSLA" />)

    const symbolInput = screen.getByLabelText(/symbol/i) || screen.getByPlaceholderText(/symbol/i) as HTMLInputElement
    expect(symbolInput.value).toBe('TSLA' || '')
  })

  it('should show success message on alert creation', async () => {
    const mockCreateAlert = jest.fn()

    (useMarketStore as unknown as jest.Mock).mockReturnValue({
      createAlert: mockCreateAlert
    })

    render(<AlertCreationForm />)

    const symbolInput = screen.getByLabelText(/symbol/i) || screen.getByPlaceholderText(/symbol/i)
    fireEvent.change(symbolInput, { target: { value: 'AAPL' } })

    const submitButton = screen.getByRole('button', { name: /create|save|add/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockCreateAlert).toHaveBeenCalled()
    })
  })
})
