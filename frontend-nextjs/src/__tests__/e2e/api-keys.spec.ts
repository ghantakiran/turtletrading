/**
 * E2E Tests for API Keys Management
 * Tests the complete user flow for generating and managing API keys
 */

import { test, expect } from '@playwright/test'

test.describe('API Keys Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('http://localhost:3005/developer/api-keys')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test.describe('Empty State', () => {
    test('should display empty state when no API keys exist', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      await expect(page.getByText('No API Keys Yet')).toBeVisible()
      await expect(page.getByText('Get started by generating your first API key')).toBeVisible()
    })

    test('should show generate first key button', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      const generateButton = page.getByRole('button', { name: /generate your first key/i })
      await expect(generateButton).toBeVisible()
    })
  })

  test.describe('Page Structure', () => {
    test('should display page title and description', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      await expect(page.getByRole('heading', { name: 'API Keys', level: 1 })).toBeVisible()
      await expect(page.getByText('Manage your API keys for TurtleTrading API access')).toBeVisible()
    })

    test('should show generate new key button in header', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      const generateButton = page.getByRole('button', { name: 'Generate New API Key' })
      await expect(generateButton).toBeVisible()
    })

    test('should display API documentation link', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      await expect(page.getByText('API Documentation')).toBeVisible()
      await expect(page.getByRole('link', { name: 'View Documentation' })).toBeVisible()
    })
  })

  test.describe('API Key Generation', () => {
    test('should open generate key dialog when button clicked', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      await page.getByRole('button', { name: 'Generate New API Key' }).click()

      await expect(page.getByRole('heading', { name: 'Generate New API Key' })).toBeVisible()
      await expect(page.getByPlaceholder('e.g., Production API Key')).toBeVisible()
    })

    test('should display all permission options', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')
      await page.getByRole('button', { name: 'Generate New API Key' }).click()

      // Check for key permissions
      await expect(page.getByText('market_data:read')).toBeVisible()
      await expect(page.getByText('ai_insights:read')).toBeVisible()
      await expect(page.getByText('portfolio:read')).toBeVisible()
      await expect(page.getByText('alerts:read')).toBeVisible()
    })

    test('should allow selecting multiple permissions', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')
      await page.getByRole('button', { name: 'Generate New API Key' }).click()

      // Select multiple permissions
      const checkboxes = page.getByRole('checkbox')
      await checkboxes.nth(0).check()
      await checkboxes.nth(1).check()

      await expect(checkboxes.nth(0)).toBeChecked()
      await expect(checkboxes.nth(1)).toBeChecked()
    })

    test('should generate API key with valid inputs', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')
      await page.getByRole('button', { name: 'Generate New API Key' }).click()

      // Fill in form
      await page.getByPlaceholder('e.g., Production API Key').fill('My Test API Key')
      await page.getByRole('checkbox').first().check()

      // Generate key
      await page.getByRole('button', { name: 'Generate Key' }).click()

      // Check success message
      await expect(page.getByText('API Key Generated Successfully!')).toBeVisible()
      await expect(page.getByText('Please save this key securely')).toBeVisible()
    })

    test('should display generated key with tt_ prefix', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')
      await page.getByRole('button', { name: 'Generate New API Key' }).click()

      await page.getByPlaceholder('e.g., Production API Key').fill('Test Key')
      await page.getByRole('checkbox').first().check()
      await page.getByRole('button', { name: 'Generate Key' }).click()

      // Find the generated key in the success message
      const keyElement = page.locator('.font-mono').first()
      const keyText = await keyElement.textContent()

      expect(keyText).toMatch(/^tt_[0-9a-f]{64}$/)
    })

    test('should close dialog after canceling', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')
      await page.getByRole('button', { name: 'Generate New API Key' }).click()

      await page.getByRole('button', { name: 'Cancel' }).click()

      await expect(page.getByRole('heading', { name: 'Generate New API Key' })).not.toBeVisible()
    })
  })

  test.describe('API Key Display', () => {
    test('should list generated API key', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      // Generate a key
      await page.getByRole('button', { name: 'Generate New API Key' }).click()
      await page.getByPlaceholder('e.g., Production API Key').fill('Test API Key')
      await page.getByRole('checkbox').first().check()
      await page.getByRole('button', { name: 'Generate Key' }).click()
      await page.getByRole('button', { name: 'Done' }).click()

      // Check key is listed
      await expect(page.getByText('Test API Key')).toBeVisible()
      await expect(page.getByText('active')).toBeVisible()
    })

    test('should mask API key by default', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      // Generate a key
      await page.getByRole('button', { name: 'Generate New API Key' }).click()
      await page.getByPlaceholder('e.g., Production API Key').fill('Test Key')
      await page.getByRole('checkbox').first().check()
      await page.getByRole('button', { name: 'Generate Key' }).click()
      await page.getByRole('button', { name: 'Done' }).click()

      // Check key is masked (after Done, success message is gone, so first .font-mono is the masked key)
      const keyElements = page.locator('.font-mono')
      const keyText = await keyElements.first().textContent()

      expect(keyText).toContain('•')
    })

    test('should display key creation date', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      // Generate a key
      await page.getByRole('button', { name: 'Generate New API Key' }).click()
      await page.getByPlaceholder('e.g., Production API Key').fill('Test Key')
      await page.getByRole('checkbox').first().check()
      await page.getByRole('button', { name: 'Generate Key' }).click()
      await page.getByRole('button', { name: 'Done' }).click()

      // Check creation date is displayed
      await expect(page.getByText(/Created:/)).toBeVisible()
    })

    test('should show usage count', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      // Generate a key
      await page.getByRole('button', { name: 'Generate New API Key' }).click()
      await page.getByPlaceholder('e.g., Production API Key').fill('Test Key')
      await page.getByRole('checkbox').first().check()
      await page.getByRole('button', { name: 'Generate Key' }).click()
      await page.getByRole('button', { name: 'Done' }).click()

      // Check usage count
      await expect(page.getByText('Usage: 0 requests')).toBeVisible()
    })

    test('should display rate limit usage bar', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      // Generate a key
      await page.getByRole('button', { name: 'Generate New API Key' }).click()
      await page.getByPlaceholder('e.g., Production API Key').fill('Test Key')
      await page.getByRole('checkbox').first().check()
      await page.getByRole('button', { name: 'Generate Key' }).click()
      await page.getByRole('button', { name: 'Done' }).click()

      // Check rate limit display
      await expect(page.getByText('Rate Limit Usage')).toBeVisible()
      await expect(page.getByText(/0 \/ 1,000/)).toBeVisible()
    })

    test('should show selected permissions', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      // Generate a key with specific permission
      await page.getByRole('button', { name: 'Generate New API Key' }).click()
      await page.getByPlaceholder('e.g., Production API Key').fill('Test Key')
      await page.getByRole('checkbox').first().check()
      await page.getByRole('button', { name: 'Generate Key' }).click()
      await page.getByRole('button', { name: 'Done' }).click()

      // Check permissions are displayed
      await expect(page.getByText('Permissions:')).toBeVisible()
      await expect(page.locator('.bg-blue-50').first()).toBeVisible()
    })
  })

  test.describe('API Key Actions', () => {
    test('should copy key to clipboard', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      await page.goto('http://localhost:3005/developer/api-keys')

      // Generate a key
      await page.getByRole('button', { name: 'Generate New API Key' }).click()
      await page.getByPlaceholder('e.g., Production API Key').fill('Test Key')
      await page.getByRole('checkbox').first().check()
      await page.getByRole('button', { name: 'Generate Key' }).click()

      // Copy from success message
      await page.getByRole('button', { name: 'Copy to Clipboard' }).click()

      // Verify copy success (button changes to checkmark)
      await expect(page.getByText('✓')).toBeVisible({ timeout: 1000 })
    })

    test('should reveal and hide API key', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      // Generate a key
      await page.getByRole('button', { name: 'Generate New API Key' }).click()
      await page.getByPlaceholder('e.g., Production API Key').fill('Test Key')
      await page.getByRole('checkbox').first().check()
      await page.getByRole('button', { name: 'Generate Key' }).click()

      // Get the full key from success message
      const fullKey = await page.locator('.font-mono').first().textContent()

      await page.getByRole('button', { name: 'Done' }).click()

      // Key should be masked initially
      const maskedKey = await page.locator('.font-mono').nth(0).textContent()
      expect(maskedKey).toContain('•')

      // Click reveal button (eye icon)
      await page.locator('button[title="Show key"]').first().click()

      // Key should now be revealed
      const revealedKey = await page.locator('.font-mono').nth(0).textContent()
      expect(revealedKey).toBe(fullKey)

      // Click hide button
      await page.locator('button[title="Hide key"]').first().click()

      // Key should be masked again
      const remaskedKey = await page.locator('.font-mono').nth(0).textContent()
      expect(remaskedKey).toContain('•')
    })

    test('should revoke API key with confirmation', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      // Generate a key
      await page.getByRole('button', { name: 'Generate New API Key' }).click()
      await page.getByPlaceholder('e.g., Production API Key').fill('Test Key')
      await page.getByRole('checkbox').first().check()
      await page.getByRole('button', { name: 'Generate Key' }).click()
      await page.getByRole('button', { name: 'Done' }).click()

      // Setup dialog handler
      page.once('dialog', dialog => {
        expect(dialog.message()).toContain('revoke')
        dialog.accept()
      })

      // Revoke key
      await page.getByRole('button', { name: 'Revoke' }).click()

      // Key should now show as revoked
      await expect(page.locator('.bg-gray-100.text-gray-800')).toBeVisible()
    })

    test('should delete API key with confirmation', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      // Generate a key
      await page.getByRole('button', { name: 'Generate New API Key' }).click()
      await page.getByPlaceholder('e.g., Production API Key').fill('Test Key To Delete')
      await page.getByRole('checkbox').first().check()
      await page.getByRole('button', { name: 'Generate Key' }).click()
      await page.getByRole('button', { name: 'Done' }).click()

      // Confirm key exists
      await expect(page.getByText('Test Key To Delete')).toBeVisible()

      // Setup dialog handler
      page.once('dialog', dialog => {
        expect(dialog.message()).toContain('delete')
        dialog.accept()
      })

      // Delete key
      await page.getByRole('button', { name: 'Delete' }).click()

      // Key should no longer be visible
      await expect(page.getByText('Test Key To Delete')).not.toBeVisible()
    })
  })

  test.describe('Persistence', () => {
    test('should persist API keys across page reloads', async ({ page }) => {
      await page.goto('http://localhost:3005/developer/api-keys')

      // Generate a key
      await page.getByRole('button', { name: 'Generate New API Key' }).click()
      await page.getByPlaceholder('e.g., Production API Key').fill('Persistent Key')
      await page.getByRole('checkbox').first().check()
      await page.getByRole('button', { name: 'Generate Key' }).click()
      await page.getByRole('button', { name: 'Done' }).click()

      // Reload page
      await page.reload()

      // Key should still be visible
      await expect(page.getByText('Persistent Key')).toBeVisible()
    })

    test('should load keys from localStorage on mount', async ({ page }) => {
      // Pre-populate localStorage
      await page.goto('http://localhost:3005/developer/api-keys')
      await page.evaluate(() => {
        const mockKey = {
          id: 'test-123',
          name: 'Preloaded Key',
          key: 'tt_' + '0'.repeat(64),
          permissions: ['market_data:read'],
          status: 'active',
          createdAt: new Date().toISOString(),
          usageCount: 42,
          rateLimit: 1000,
          currentUsage: 100,
        }
        localStorage.setItem('turtle_api_keys', JSON.stringify([mockKey]))
      })

      // Reload to load from storage
      await page.reload()

      // Check preloaded key is displayed
      await expect(page.getByText('Preloaded Key')).toBeVisible()
      await expect(page.getByText('Usage: 42 requests')).toBeVisible()
    })
  })
})
