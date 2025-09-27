/**
 * UI State Store Unit Tests
 * 100% coverage for Zustand UI state management
 */

import { act, renderHook } from '@testing-library/react'
import { useUIStore } from '../uiStore'

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }))
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock console methods
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(),
  warn: jest.spyOn(console, 'warn').mockImplementation(),
  log: jest.spyOn(console, 'log').mockImplementation(),
}

describe('UI State Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useUIStore.getState().reset()
    })

    // Clear localStorage mock
    mockLocalStorage.clear()

    // Clear all mocks
    jest.clearAllMocks()
  })

  afterAll(() => {
    // Restore console methods
    Object.values(consoleSpy).forEach(spy => spy.mockRestore())
  })

  describe('Initial State', () => {
    it('should initialize with default UI state', () => {
      const { result } = renderHook(() => useUIStore())
      const state = result.current

      expect(state.theme).toBe('system')
      expect(state.sidebarOpen).toBe(true)
      expect(state.isMobile).toBe(false)
      expect(state.screenSize.width).toBe(1024)
      expect(state.screenSize.height).toBe(768)
      expect(state.notifications).toEqual([])
      expect(state.modals).toEqual({})
      expect(state.loading).toEqual({})
      expect(state.preferences.currency).toBe('USD')
      expect(state.preferences.timezone).toBe('America/New_York')
      expect(state.preferences.numberFormat).toBe('US')
      expect(state.chartSettings.defaultTimeframe).toBe('1D')
      expect(state.chartSettings.showVolume).toBe(true)
      expect(state.layoutSettings.compactMode).toBe(false)
      expect(state.layoutSettings.showBreadcrumbs).toBe(true)
    })

    it('should load preferences from localStorage', () => {
      const savedPreferences = {
        theme: 'dark',
        currency: 'EUR',
        timezone: 'Europe/London',
        numberFormat: 'EU',
        chartSettings: {
          defaultTimeframe: '5M',
          showVolume: false,
          indicators: ['RSI', 'MACD']
        }
      }

      mockLocalStorage.setItem('ui_preferences', JSON.stringify(savedPreferences))

      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.loadPreferences()
      })

      expect(result.current.theme).toBe('dark')
      expect(result.current.preferences.currency).toBe('EUR')
      expect(result.current.preferences.timezone).toBe('Europe/London')
      expect(result.current.chartSettings.defaultTimeframe).toBe('5M')
      expect(result.current.chartSettings.showVolume).toBe(false)
    })
  })

  describe('Theme Management', () => {
    it('should manage theme switching (light/dark)', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setTheme('dark')
      })
      expect(result.current.theme).toBe('dark')

      act(() => {
        result.current.setTheme('light')
      })
      expect(result.current.theme).toBe('light')

      act(() => {
        result.current.setTheme('system')
      })
      expect(result.current.theme).toBe('system')
    })

    it('should toggle between light and dark themes', () => {
      const { result } = renderHook(() => useUIStore())

      // Start with light theme
      act(() => {
        result.current.setTheme('light')
      })

      act(() => {
        result.current.toggleTheme()
      })
      expect(result.current.theme).toBe('dark')

      act(() => {
        result.current.toggleTheme()
      })
      expect(result.current.theme).toBe('light')
    })

    it('should handle system theme preference', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setTheme('system')
      })

      // Mock system preference for dark mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        }))
      })

      act(() => {
        result.current.detectSystemTheme()
      })

      expect(result.current.effectiveTheme).toBe('dark')
    })
  })

  describe('Responsive Design Management', () => {
    it('should handle responsive layout changes', () => {
      const { result } = renderHook(() => useUIStore())

      // Simulate mobile viewport
      act(() => {
        result.current.updateScreenSize(375, 667)
      })

      expect(result.current.screenSize.width).toBe(375)
      expect(result.current.screenSize.height).toBe(667)
      expect(result.current.isMobile).toBe(true)

      // Simulate desktop viewport
      act(() => {
        result.current.updateScreenSize(1920, 1080)
      })

      expect(result.current.screenSize.width).toBe(1920)
      expect(result.current.screenSize.height).toBe(1080)
      expect(result.current.isMobile).toBe(false)
    })

    it('should manage sidebar state based on screen size', () => {
      const { result } = renderHook(() => useUIStore())

      // Desktop - sidebar should be open by default
      act(() => {
        result.current.updateScreenSize(1920, 1080)
      })
      expect(result.current.sidebarOpen).toBe(true)

      // Mobile - sidebar should close automatically
      act(() => {
        result.current.updateScreenSize(375, 667)
      })
      expect(result.current.sidebarOpen).toBe(false)

      // Toggle sidebar on mobile
      act(() => {
        result.current.toggleSidebar()
      })
      expect(result.current.sidebarOpen).toBe(true)
    })

    it('should detect breakpoints correctly', () => {
      const { result } = renderHook(() => useUIStore())

      // Test mobile breakpoint
      act(() => {
        result.current.updateScreenSize(480, 800)
      })
      expect(result.current.currentBreakpoint).toBe('mobile')

      // Test tablet breakpoint
      act(() => {
        result.current.updateScreenSize(768, 1024)
      })
      expect(result.current.currentBreakpoint).toBe('tablet')

      // Test desktop breakpoint
      act(() => {
        result.current.updateScreenSize(1200, 800)
      })
      expect(result.current.currentBreakpoint).toBe('desktop')

      // Test large desktop breakpoint
      act(() => {
        result.current.updateScreenSize(1920, 1080)
      })
      expect(result.current.currentBreakpoint).toBe('desktop-lg')
    })
  })

  describe('Notification System', () => {
    it('should manage modal and notification states', () => {
      const { result } = renderHook(() => useUIStore())
      const notification = {
        id: 'notif-1',
        type: 'success' as const,
        title: 'Success',
        message: 'Operation completed successfully',
        duration: 5000,
        timestamp: new Date().toISOString()
      }

      act(() => {
        result.current.showNotification(notification)
      })

      expect(result.current.notifications).toContain(notification)
    })

    it('should auto-remove notifications after duration', async () => {
      const { result } = renderHook(() => useUIStore())
      const notification = {
        id: 'notif-auto',
        type: 'info' as const,
        title: 'Info',
        message: 'Auto-remove test',
        duration: 100, // Short duration for testing
        timestamp: new Date().toISOString()
      }

      act(() => {
        result.current.showNotification(notification)
      })

      expect(result.current.notifications).toContain(notification)

      // Wait for auto-removal
      await new Promise(resolve => setTimeout(resolve, 150))

      act(() => {
        // Trigger any pending state updates
        result.current.hideNotification('notif-auto')
      })

      expect(result.current.notifications.find(n => n.id === 'notif-auto')).toBeUndefined()
    })

    it('should remove specific notifications', () => {
      const { result } = renderHook(() => useUIStore())
      const notification1 = {
        id: 'notif-1',
        type: 'success' as const,
        title: 'Success 1',
        message: 'Message 1',
        timestamp: new Date().toISOString()
      }
      const notification2 = {
        id: 'notif-2',
        type: 'error' as const,
        title: 'Error 1',
        message: 'Message 2',
        timestamp: new Date().toISOString()
      }

      act(() => {
        result.current.showNotification(notification1)
        result.current.showNotification(notification2)
      })

      expect(result.current.notifications).toHaveLength(2)

      act(() => {
        result.current.hideNotification('notif-1')
      })

      expect(result.current.notifications).toHaveLength(1)
      expect(result.current.notifications[0].id).toBe('notif-2')
    })

    it('should clear all notifications', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.showNotification({
          id: 'notif-1',
          type: 'info',
          title: 'Info 1',
          message: 'Message 1',
          timestamp: new Date().toISOString()
        })
        result.current.showNotification({
          id: 'notif-2',
          type: 'warning',
          title: 'Warning 1',
          message: 'Message 2',
          timestamp: new Date().toISOString()
        })
      })

      expect(result.current.notifications).toHaveLength(2)

      act(() => {
        result.current.clearNotifications()
      })

      expect(result.current.notifications).toHaveLength(0)
    })
  })

  describe('Modal Management', () => {
    it('should manage modal states', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.showModal('settings', { tab: 'general' })
      })

      expect(result.current.modals.settings).toEqual({
        isOpen: true,
        data: { tab: 'general' }
      })

      act(() => {
        result.current.hideModal('settings')
      })

      expect(result.current.modals.settings?.isOpen).toBe(false)
    })

    it('should close all modals', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.showModal('settings', {})
        result.current.showModal('profile', {})
        result.current.showModal('about', {})
      })

      expect(Object.keys(result.current.modals)).toHaveLength(3)

      act(() => {
        result.current.closeAllModals()
      })

      Object.values(result.current.modals).forEach(modal => {
        expect(modal.isOpen).toBe(false)
      })
    })

    it('should update modal data', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.showModal('settings', { tab: 'general' })
      })

      act(() => {
        result.current.updateModalData('settings', { tab: 'notifications' })
      })

      expect(result.current.modals.settings?.data).toEqual({ tab: 'notifications' })
    })
  })

  describe('Loading States', () => {
    it('should handle loading and error UI states', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setLoading('fetchStocks', true)
      })

      expect(result.current.loading.fetchStocks).toBe(true)
      expect(result.current.isLoading('fetchStocks')).toBe(true)

      act(() => {
        result.current.setLoading('fetchStocks', false)
      })

      expect(result.current.loading.fetchStocks).toBe(false)
      expect(result.current.isLoading('fetchStocks')).toBe(false)
    })

    it('should handle multiple loading states', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setLoading('api1', true)
        result.current.setLoading('api2', true)
        result.current.setLoading('api3', false)
      })

      expect(result.current.isLoading('api1')).toBe(true)
      expect(result.current.isLoading('api2')).toBe(true)
      expect(result.current.isLoading('api3')).toBe(false)
      expect(result.current.hasAnyLoading).toBe(true)

      act(() => {
        result.current.setLoading('api1', false)
        result.current.setLoading('api2', false)
      })

      expect(result.current.hasAnyLoading).toBe(false)
    })

    it('should clear all loading states', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setLoading('api1', true)
        result.current.setLoading('api2', true)
        result.current.setLoading('api3', true)
      })

      expect(result.current.hasAnyLoading).toBe(true)

      act(() => {
        result.current.clearLoading()
      })

      expect(result.current.hasAnyLoading).toBe(false)
      expect(Object.keys(result.current.loading)).toHaveLength(0)
    })
  })

  describe('User Preferences', () => {
    it('should persist user preferences', () => {
      const { result } = renderHook(() => useUIStore())

      const newPreferences = {
        currency: 'EUR',
        timezone: 'Europe/London',
        numberFormat: 'EU',
        notifications: false,
        soundEnabled: false,
        autoRefresh: false,
        refreshInterval: 10000
      }

      act(() => {
        result.current.updatePreferences(newPreferences)
      })

      expect(result.current.preferences).toMatchObject(newPreferences)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'ui_preferences',
        expect.stringContaining('"currency":"EUR"')
      )
    })

    it('should update individual preference values', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.updatePreference('currency', 'GBP')
      })

      expect(result.current.preferences.currency).toBe('GBP')

      act(() => {
        result.current.updatePreference('soundEnabled', false)
      })

      expect(result.current.preferences.soundEnabled).toBe(false)
    })
  })

  describe('Chart Preferences', () => {
    it('should manage chart display preferences', () => {
      const { result } = renderHook(() => useUIStore())

      const newChartSettings = {
        defaultTimeframe: '1H',
        showVolume: false,
        indicators: ['RSI', 'MACD', 'BB'],
        chartType: 'line' as const,
        theme: 'dark' as const
      }

      act(() => {
        result.current.updateChartSettings(newChartSettings)
      })

      expect(result.current.chartSettings).toMatchObject(newChartSettings)
    })

    it('should update individual chart settings', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.updateChartSetting('defaultTimeframe', '30M')
      })

      expect(result.current.chartSettings.defaultTimeframe).toBe('30M')

      act(() => {
        result.current.updateChartSetting('showVolume', false)
      })

      expect(result.current.chartSettings.showVolume).toBe(false)
    })
  })

  describe('Layout Settings', () => {
    it('should manage layout preferences', () => {
      const { result } = renderHook(() => useUIStore())

      const newLayoutSettings = {
        compactMode: true,
        showBreadcrumbs: false,
        sidebarPosition: 'right' as const,
        panelSizes: {
          sidebar: 280,
          main: 800,
          details: 320
        }
      }

      act(() => {
        result.current.updateLayoutSettings(newLayoutSettings)
      })

      expect(result.current.layoutSettings).toMatchObject(newLayoutSettings)
    })

    it('should update panel sizes', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.updatePanelSize('sidebar', 300)
      })

      expect(result.current.layoutSettings.panelSizes.sidebar).toBe(300)

      act(() => {
        result.current.updatePanelSize('main', 900)
      })

      expect(result.current.layoutSettings.panelSizes.main).toBe(900)
    })
  })

  describe('State Persistence', () => {
    it('should save preferences to localStorage', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.updatePreferences({
          currency: 'EUR',
          timezone: 'Europe/London'
        })
        result.current.updateChartSettings({
          defaultTimeframe: '5M',
          showVolume: false
        })
        result.current.setTheme('dark')
      })

      act(() => {
        result.current.savePreferences()
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'ui_preferences',
        expect.stringContaining('"theme":"dark"')
      )
    })

    it('should handle localStorage errors gracefully', () => {
      const { result } = renderHook(() => useUIStore())

      // Mock localStorage.setItem to throw error
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full')
      })

      act(() => {
        result.current.savePreferences()
      })

      // Should not crash
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Failed to save UI preferences:',
        expect.any(Error)
      )
    })
  })

  describe('Store Reset and Cleanup', () => {
    it('should reset UI state to defaults', () => {
      const { result } = renderHook(() => useUIStore())

      // Set some custom state
      act(() => {
        result.current.setTheme('dark')
        result.current.updatePreferences({ currency: 'EUR' })
        result.current.showNotification({
          id: 'test',
          type: 'info',
          title: 'Test',
          message: 'Test message',
          timestamp: new Date().toISOString()
        })
        result.current.showModal('test', {})
        result.current.setLoading('test', true)
      })

      // Reset
      act(() => {
        result.current.reset()
      })

      const state = result.current
      expect(state.theme).toBe('system')
      expect(state.preferences.currency).toBe('USD')
      expect(state.notifications).toHaveLength(0)
      expect(Object.keys(state.modals)).toHaveLength(0)
      expect(Object.keys(state.loading)).toHaveLength(0)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed localStorage data', () => {
      const { result } = renderHook(() => useUIStore())

      mockLocalStorage.getItem.mockReturnValue('invalid-json')

      act(() => {
        result.current.loadPreferences()
      })

      // Should not crash and should maintain default preferences
      expect(result.current.preferences.currency).toBe('USD')
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Failed to load UI preferences:',
        expect.any(Error)
      )
    })

    it('should handle missing notification data', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.showNotification({
          id: 'incomplete',
          type: 'info',
          title: '',
          message: '',
          timestamp: new Date().toISOString()
        })
      })

      expect(result.current.notifications).toHaveLength(1)
      expect(result.current.notifications[0].title).toBe('')
    })

    it('should handle invalid modal operations', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.hideModal('non-existent')
      })

      // Should not crash
      expect(result.current.modals['non-existent']).toBeUndefined()
    })

    it('should handle extreme screen sizes', () => {
      const { result } = renderHook(() => useUIStore())

      // Very small screen
      act(() => {
        result.current.updateScreenSize(200, 300)
      })

      expect(result.current.isMobile).toBe(true)
      expect(result.current.currentBreakpoint).toBe('mobile')

      // Very large screen
      act(() => {
        result.current.updateScreenSize(4000, 2000)
      })

      expect(result.current.isMobile).toBe(false)
      expect(result.current.currentBreakpoint).toBe('desktop-lg')
    })
  })
})