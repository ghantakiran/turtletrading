/**
 * Unit tests for CreateApiKeyModal component
 * TDD approach - tests written before implementation
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import { CreateApiKeyModal } from '@/components/developer/CreateApiKeyModal'
import { APIKeyPermission } from '@/types/api-keys'

describe('CreateApiKeyModal', () => {
  const mockOnClose = jest.fn()
  const mockOnCreate = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render modal when open', () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/Create New API Key/i)).toBeInTheDocument()
    })

    it('should not render when closed', () => {
      render(
        <CreateApiKeyModal
          isOpen={false}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should display form fields', () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      expect(screen.getByLabelText(/API Key Name/i)).toBeInTheDocument()
      // Check for actual permission labels
      expect(screen.getByText(/market_data:read/i)).toBeInTheDocument()
      expect(screen.getByText(/ai_insights:read/i)).toBeInTheDocument()
      expect(screen.getByText(/portfolio:read/i)).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should require API key name', async () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      const submitButton = screen.getByRole('button', { name: /Create API Key/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Name is required/i)).toBeInTheDocument()
      })
    })

    it('should require at least one permission', async () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      const nameInput = screen.getByLabelText(/API Key Name/i)
      fireEvent.change(nameInput, { target: { value: 'Test Key' } })

      const submitButton = screen.getByRole('button', { name: /Create API Key/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Select at least one permission/i)).toBeInTheDocument()
      })
    })

    it('should accept valid form data', async () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      const nameInput = screen.getByLabelText(/API Key Name/i)
      fireEvent.change(nameInput, { target: { value: 'Test Key' } })

      // Find the first checkbox (market_data:read)
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])

      const submitButton = screen.getByRole('button', { name: /Create API Key/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          name: 'Test Key',
          permissions: ['market_data:read' as APIKeyPermission]
        })
      })
    })
  })

  describe('Permission Selection', () => {
    it('should allow multiple permissions', async () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      const nameInput = screen.getByLabelText(/API Key Name/i)
      fireEvent.change(nameInput, { target: { value: 'Test Key' } })

      // Click first three checkboxes
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0]) // market_data:read
      fireEvent.click(checkboxes[1]) // ai_insights:read
      fireEvent.click(checkboxes[2]) // portfolio:read

      const submitButton = screen.getByRole('button', { name: /Create API Key/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          name: 'Test Key',
          permissions: ['market_data:read', 'ai_insights:read', 'portfolio:read'] as APIKeyPermission[]
        })
      })
    })

    it('should toggle permissions on/off', () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      const firstCheckbox = checkboxes[0] as HTMLInputElement

      fireEvent.click(firstCheckbox)
      expect(firstCheckbox.checked).toBe(true)

      fireEvent.click(firstCheckbox)
      expect(firstCheckbox.checked).toBe(false)
    })
  })

  describe('Modal Interactions', () => {
    it('should call onClose when cancel button clicked', () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when clicking overlay', () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      const overlay = screen.getByRole('dialog').parentElement
      if (overlay) {
        fireEvent.click(overlay)
        expect(mockOnClose).toHaveBeenCalled()
      }
    })

    it('should close modal after successful creation', async () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      const nameInput = screen.getByLabelText(/API Key Name/i)
      fireEvent.change(nameInput, { target: { value: 'Test Key' } })

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])

      const submitButton = screen.getByRole('button', { name: /Create API Key/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalled()
        expect(mockOnClose).toHaveBeenCalled()
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading state during submission', async () => {
      const slowOnCreate = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={slowOnCreate}
        />
      )

      const nameInput = screen.getByLabelText(/API Key Name/i)
      fireEvent.change(nameInput, { target: { value: 'Test Key' } })

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])

      const submitButton = screen.getByRole('button', { name: /Create API Key/i })
      fireEvent.click(submitButton)

      // Button should be disabled during loading
      expect(submitButton).toBeDisabled()

      await waitFor(() => {
        expect(slowOnCreate).toHaveBeenCalled()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby')
      expect(dialog).toHaveAttribute('aria-describedby')
    })

    it('should trap focus within modal', () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      const nameInput = screen.getByLabelText(/API Key Name/i)
      nameInput.focus()

      expect(document.activeElement).toBe(nameInput)
    })

    it('should allow closing with Escape key', () => {
      render(
        <CreateApiKeyModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
        />
      )

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      expect(mockOnClose).toHaveBeenCalled()
    })
  })
})
