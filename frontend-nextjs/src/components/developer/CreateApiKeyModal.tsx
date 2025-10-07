'use client'

/**
 * CreateApiKeyModal Component
 * Modal dialog for creating new API keys with permission selection
 */

import { useState } from 'react'
import { X } from 'lucide-react'

import { APIKeyPermission, API_KEY_PERMISSIONS } from '@/types/api-keys'

export interface CreateApiKeyFormData {
  name: string
  permissions: APIKeyPermission[]
}

export interface CreateApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: CreateApiKeyFormData) => void | Promise<void>
}

export function CreateApiKeyModal({ isOpen, onClose, onCreate }: CreateApiKeyModalProps) {
  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<APIKeyPermission[]>([])
  const [errors, setErrors] = useState<{ name?: string; permissions?: string }>({})
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  const handlePermissionToggle = (permission: APIKeyPermission) => {
    setPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    )
    // Clear permission error when user selects a permission
    if (errors.permissions) {
      setErrors(prev => ({ ...prev, permissions: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: { name?: string; permissions?: string } = {}

    if (!name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (permissions.length === 0) {
      newErrors.permissions = 'Select at least one permission'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      await onCreate({ name, permissions })
      // Reset form
      setName('')
      setPermissions([])
      setErrors({})
      onClose()
    } catch (error) {
      console.error('Failed to create API key:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setName('')
    setPermissions([])
    setErrors({})
    onClose()
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
            Create New API Key
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <p id="modal-description" className="text-sm text-gray-600 mb-4">
            Create a new API key to access the TurtleTrading API. You can configure permissions below.
          </p>

          {/* Name Input */}
          <div className="mb-4">
            <label htmlFor="api-key-name" className="block text-sm font-medium text-gray-700 mb-2">
              API Key Name
            </label>
            <input
              id="api-key-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) {
                  setErrors(prev => ({ ...prev, name: undefined }))
                }
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Production API Key"
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Permissions */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions
            </label>
            <div className="space-y-2">
              {(Object.entries(API_KEY_PERMISSIONS) as [APIKeyPermission, string][]).map(
                ([permission, description]) => (
                  <label key={permission} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={permissions.includes(permission)}
                      onChange={() => handlePermissionToggle(permission)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {permission} - {description}
                    </span>
                  </label>
                )
              )}
            </div>
            {errors.permissions && (
              <p className="mt-1 text-sm text-red-600">{errors.permissions}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create API Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
