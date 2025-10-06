'use client'

/**
 * API Keys Management Page
 * Allows developers to generate, manage, and monitor API keys
 */

import { useState, useEffect } from 'react'
import { APIKey, APIKeyPermission, API_KEY_PERMISSIONS } from '@/types/api-keys'
import {
  createAPIKey,
  maskAPIKey,
  loadAPIKeys,
  saveAPIKeys,
  revokeAPIKey as revokeKey,
  deleteAPIKey as deleteKey,
  getUsagePercentage,
  isApproachingLimit,
  isRateLimitExceeded,
} from '@/lib/api-keys/utils'

export default function APIKeysPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<APIKeyPermission[]>([])
  const [generatedKey, setGeneratedKey] = useState<APIKey | null>(null)
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [copySuccess, setCopySuccess] = useState<string | null>(null)

  // Load API keys on mount
  useEffect(() => {
    const keys = loadAPIKeys()
    setApiKeys(keys)
  }, [])

  // Save keys whenever they change
  useEffect(() => {
    if (apiKeys.length > 0) {
      saveAPIKeys(apiKeys)
    }
  }, [apiKeys])

  const handleGenerateKey = () => {
    if (!newKeyName.trim()) {
      alert('Please enter a name for the API key')
      return
    }

    if (selectedPermissions.length === 0) {
      alert('Please select at least one permission')
      return
    }

    const newKey = createAPIKey({
      name: newKeyName.trim(),
      permissions: selectedPermissions,
      rateLimit: 1000, // Free tier default
    })

    setApiKeys(prev => [...prev, newKey])
    setGeneratedKey(newKey)
    setNewKeyName('')
    setSelectedPermissions([])
    setShowNewKeyDialog(false)
  }

  const handleCopyKey = async (key: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopySuccess(keyId)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleToggleReveal = (keyId: string) => {
    setRevealedKeys(prev => {
      const next = new Set(prev)
      if (next.has(keyId)) {
        next.delete(keyId)
      } else {
        next.add(keyId)
      }
      return next
    })
  }

  const handleRevokeKey = (keyId: string) => {
    if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      setApiKeys(prev => revokeKey(prev, keyId))
    }
  }

  const handleDeleteKey = (keyId: string) => {
    if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      setApiKeys(prev => deleteKey(prev, keyId))
    }
  }

  const togglePermission = (permission: APIKeyPermission) => {
    setSelectedPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
          <p className="mt-2 text-gray-600">
            Manage your API keys for TurtleTrading API access
          </p>
        </div>

        {/* Generate New Key Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowNewKeyDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Generate New API Key
          </button>
        </div>

        {/* New Key Dialog */}
        {showNewKeyDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6">Generate New API Key</h2>

              {/* Key Name Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Permissions Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permissions
                </label>
                <div className="space-y-3">
                  {(Object.entries(API_KEY_PERMISSIONS) as [APIKeyPermission, string][]).map(
                    ([permission, description]) => (
                      <label
                        key={permission}
                        className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(permission)}
                          onChange={() => togglePermission(permission)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{permission}</div>
                          <div className="text-sm text-gray-600">{description}</div>
                        </div>
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowNewKeyDialog(false)
                    setNewKeyName('')
                    setSelectedPermissions([])
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateKey}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Generate Key
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generated Key Success */}
        {generatedKey && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-green-900">API Key Generated Successfully!</h3>
                <div className="mt-2 text-sm text-green-800">
                  <p className="mb-2">Please save this key securely. You won't be able to see it again.</p>
                  <div className="bg-white border border-green-300 rounded p-3 font-mono text-sm break-all">
                    {generatedKey.key}
                  </div>
                </div>
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={() => handleCopyKey(generatedKey.key, generatedKey.id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={() => setGeneratedKey(null)}
                    className="px-4 py-2 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API Keys List */}
        {apiKeys.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No API Keys Yet</h3>
              <p className="mt-2 text-sm text-gray-600">
                Get started by generating your first API key to access the TurtleTrading API.
              </p>
              <button
                onClick={() => setShowNewKeyDialog(true)}
                className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Generate Your First Key
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {apiKeys.map((apiKey) => {
              const usagePercentage = getUsagePercentage(apiKey)
              const isRevealed = revealedKeys.has(apiKey.id)
              const limitExceeded = isRateLimitExceeded(apiKey)
              const approachingLimit = isApproachingLimit(apiKey)

              return (
                <div
                  key={apiKey.id}
                  className={`bg-white rounded-lg border p-6 ${
                    apiKey.status === 'revoked' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-gray-900">{apiKey.name}</h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            apiKey.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {apiKey.status}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                        <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                        {apiKey.lastUsed && (
                          <span>Last used: {new Date(apiKey.lastUsed).toLocaleDateString()}</span>
                        )}
                        <span>Usage: {apiKey.usageCount.toLocaleString()} requests</span>
                      </div>
                    </div>
                  </div>

                  {/* API Key Display */}
                  <div className="mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-50 border border-gray-200 rounded p-3 font-mono text-sm">
                        {isRevealed ? apiKey.key : maskAPIKey(apiKey.key)}
                      </div>
                      <button
                        onClick={() => handleToggleReveal(apiKey.id)}
                        className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title={isRevealed ? 'Hide key' : 'Show key'}
                      >
                        {isRevealed ? '👁️‍🗨️' : '👁️'}
                      </button>
                      <button
                        onClick={() => handleCopyKey(apiKey.key, apiKey.id)}
                        className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Copy key"
                      >
                        {copySuccess === apiKey.id ? '✓' : '📋'}
                      </button>
                    </div>
                  </div>

                  {/* Usage Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">Rate Limit Usage</span>
                      <span className={`font-medium ${
                        limitExceeded ? 'text-red-600' :
                        approachingLimit ? 'text-yellow-600' :
                        'text-gray-900'
                      }`}>
                        {apiKey.currentUsage.toLocaleString()} / {apiKey.rateLimit.toLocaleString()}
                        {' '}({usagePercentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          limitExceeded ? 'bg-red-500' :
                          approachingLimit ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, usagePercentage)}%` }}
                      />
                    </div>
                    {limitExceeded && (
                      <p className="mt-2 text-sm text-red-600">
                        Rate limit exceeded. Requests will be blocked until next reset.
                      </p>
                    )}
                    {approachingLimit && !limitExceeded && (
                      <p className="mt-2 text-sm text-yellow-600">
                        Approaching rate limit. Consider upgrading your plan.
                      </p>
                    )}
                  </div>

                  {/* Permissions */}
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Permissions:</div>
                    <div className="flex flex-wrap gap-2">
                      {apiKey.permissions.map((permission) => (
                        <span
                          key={permission}
                          className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {apiKey.status === 'active' && (
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleRevokeKey(apiKey.id)}
                        className="px-4 py-2 text-yellow-700 hover:bg-yellow-50 rounded-lg text-sm font-medium transition-colors border border-yellow-200"
                      >
                        Revoke
                      </button>
                      <button
                        onClick={() => handleDeleteKey(apiKey.id)}
                        className="px-4 py-2 text-red-700 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors border border-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Documentation Link */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">API Documentation</h3>
          <p className="text-blue-800 mb-4">
            Learn how to use your API keys to access the TurtleTrading API.
          </p>
          <a
            href="/developer/docs"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            View Documentation
          </a>
        </div>
      </div>
    </div>
  )
}
