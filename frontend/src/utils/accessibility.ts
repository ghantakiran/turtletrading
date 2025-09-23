/**
 * Mobile Accessibility Utilities
 * Comprehensive accessibility support for mobile trading platform
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Accessibility preferences interface
export interface AccessibilityPreferences {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  voiceNavigation: boolean;
  hapticFeedback: boolean;
  screenReader: boolean;
  colorBlindFriendly: boolean;
  soundAlerts: boolean;
}

// Voice commands interface
export interface VoiceCommand {
  phrase: string;
  action: () => void;
  description: string;
}

// Haptic feedback patterns
export enum HapticPattern {
  LIGHT = 'light',
  MEDIUM = 'medium',
  HEAVY = 'heavy',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  SELECTION = 'selection',
  IMPACT = 'impact'
}

// Screen reader announcements
export enum AnnouncementPriority {
  POLITE = 'polite',
  ASSERTIVE = 'assertive',
  OFF = 'off'
}

export class AccessibilityManager {
  private static instance: AccessibilityManager;
  private preferences: AccessibilityPreferences;
  private voiceCommands: Map<string, VoiceCommand> = new Map();
  private speechSynthesis: SpeechSynthesis | null = null;
  private speechRecognition: any = null;
  private hapticSupported = false;

  private constructor() {
    this.preferences = this.loadPreferences();
    this.initializeAccessibilityFeatures();
  }

  public static getInstance(): AccessibilityManager {
    if (!AccessibilityManager.instance) {
      AccessibilityManager.instance = new AccessibilityManager();
    }
    return AccessibilityManager.instance;
  }

  /**
   * Initialize accessibility features
   */
  private initializeAccessibilityFeatures(): void {
    // Check for speech synthesis support
    if ('speechSynthesis' in window) {
      this.speechSynthesis = window.speechSynthesis;
    }

    // Check for speech recognition support
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.speechRecognition = new SpeechRecognition();
      this.setupSpeechRecognition();
    }

    // Check for haptic feedback support
    this.hapticSupported = 'vibrate' in navigator;

    // Apply initial preferences
    this.applyAccessibilityPreferences();

    // Listen for system preference changes
    this.setupSystemPreferenceListeners();
  }

  /**
   * Load accessibility preferences from storage
   */
  private loadPreferences(): AccessibilityPreferences {
    const stored = localStorage.getItem('accessibility-preferences');
    const defaultPreferences: AccessibilityPreferences = {
      reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      highContrast: window.matchMedia('(prefers-contrast: high)').matches,
      largeText: false,
      voiceNavigation: false,
      hapticFeedback: true,
      screenReader: this.detectScreenReader(),
      colorBlindFriendly: false,
      soundAlerts: true
    };

    if (stored) {
      try {
        return { ...defaultPreferences, ...JSON.parse(stored) };
      } catch (error) {
        console.warn('Failed to parse accessibility preferences:', error);
      }
    }

    return defaultPreferences;
  }

  /**
   * Save accessibility preferences
   */
  public savePreferences(preferences: Partial<AccessibilityPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
    localStorage.setItem('accessibility-preferences', JSON.stringify(this.preferences));
    this.applyAccessibilityPreferences();
  }

  /**
   * Get current accessibility preferences
   */
  public getPreferences(): AccessibilityPreferences {
    return { ...this.preferences };
  }

  /**
   * Apply accessibility preferences to the page
   */
  private applyAccessibilityPreferences(): void {
    const root = document.documentElement;

    // Reduce motion
    if (this.preferences.reduceMotion) {
      root.style.setProperty('--animation-duration', '0.01s');
      root.style.setProperty('--transition-duration', '0.01s');
    } else {
      root.style.removeProperty('--animation-duration');
      root.style.removeProperty('--transition-duration');
    }

    // High contrast
    if (this.preferences.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Large text
    if (this.preferences.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }

    // Color blind friendly
    if (this.preferences.colorBlindFriendly) {
      root.classList.add('color-blind-friendly');
    } else {
      root.classList.remove('color-blind-friendly');
    }
  }

  /**
   * Setup system preference listeners
   */
  private setupSystemPreferenceListeners(): void {
    // Reduced motion preference
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotionQuery.addEventListener('change', (e) => {
      this.savePreferences({ reduceMotion: e.matches });
    });

    // High contrast preference
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    highContrastQuery.addEventListener('change', (e) => {
      this.savePreferences({ highContrast: e.matches });
    });

    // Color scheme preference
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    colorSchemeQuery.addEventListener('change', () => {
      this.announceToScreenReader('Color scheme changed', AnnouncementPriority.POLITE);
    });
  }

  /**
   * Detect screen reader presence
   */
  private detectScreenReader(): boolean {
    // Multiple detection methods for screen readers
    const userAgent = navigator.userAgent.toLowerCase();

    // Check for common screen readers in user agent
    const screenReaderIndicators = [
      'nvda', 'jaws', 'voiceover', 'talkback', 'orca', 'dragon'
    ];

    const hasScreenReaderUA = screenReaderIndicators.some(sr => userAgent.includes(sr));

    // Check for accessibility tree presence
    const hasAccessibilityTree = 'accessibilityTree' in document;

    // Check for reduced motion (often enabled with screen readers)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return hasScreenReaderUA || hasAccessibilityTree || reducedMotion;
  }

  /**
   * Announce message to screen reader
   */
  public announceToScreenReader(
    message: string,
    priority: AnnouncementPriority = AnnouncementPriority.POLITE
  ): void {
    if (!this.preferences.screenReader) return;

    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.style.cssText = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `;

    document.body.appendChild(announcement);

    // Add message after a brief delay to ensure it's announced
    setTimeout(() => {
      announcement.textContent = message;
    }, 100);

    // Remove after announcement
    setTimeout(() => {
      if (announcement.parentNode) {
        announcement.parentNode.removeChild(announcement);
      }
    }, 2000);
  }

  /**
   * Speak text aloud
   */
  public speak(text: string, interrupt: boolean = false): void {
    if (!this.speechSynthesis || !this.preferences.soundAlerts) return;

    if (interrupt) {
      this.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    this.speechSynthesis.speak(utterance);
  }

  /**
   * Setup speech recognition for voice commands
   */
  private setupSpeechRecognition(): void {
    if (!this.speechRecognition) return;

    this.speechRecognition.continuous = true;
    this.speechRecognition.interimResults = false;
    this.speechRecognition.lang = 'en-US';

    this.speechRecognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      this.handleVoiceCommand(transcript);
    };

    this.speechRecognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
    };
  }

  /**
   * Register voice command
   */
  public registerVoiceCommand(command: VoiceCommand): void {
    this.voiceCommands.set(command.phrase.toLowerCase(), command);
  }

  /**
   * Handle voice command
   */
  private handleVoiceCommand(transcript: string): void {
    // Check for exact matches first
    const exactMatch = this.voiceCommands.get(transcript);
    if (exactMatch) {
      exactMatch.action();
      this.triggerHapticFeedback(HapticPattern.SUCCESS);
      return;
    }

    // Check for partial matches
    for (const [phrase, command] of this.voiceCommands) {
      if (transcript.includes(phrase) || phrase.includes(transcript)) {
        command.action();
        this.triggerHapticFeedback(HapticPattern.SUCCESS);
        return;
      }
    }

    // No command found
    this.triggerHapticFeedback(HapticPattern.ERROR);
    this.announceToScreenReader('Command not recognized', AnnouncementPriority.POLITE);
  }

  /**
   * Start voice navigation
   */
  public startVoiceNavigation(): void {
    if (!this.speechRecognition || !this.preferences.voiceNavigation) return;

    this.speechRecognition.start();
    this.announceToScreenReader('Voice navigation started', AnnouncementPriority.POLITE);
  }

  /**
   * Stop voice navigation
   */
  public stopVoiceNavigation(): void {
    if (!this.speechRecognition) return;

    this.speechRecognition.stop();
    this.announceToScreenReader('Voice navigation stopped', AnnouncementPriority.POLITE);
  }

  /**
   * Trigger haptic feedback
   */
  public triggerHapticFeedback(pattern: HapticPattern): void {
    if (!this.hapticSupported || !this.preferences.hapticFeedback) return;

    let vibrationPattern: number[];

    switch (pattern) {
      case HapticPattern.LIGHT:
        vibrationPattern = [50];
        break;
      case HapticPattern.MEDIUM:
        vibrationPattern = [100];
        break;
      case HapticPattern.HEAVY:
        vibrationPattern = [200];
        break;
      case HapticPattern.SUCCESS:
        vibrationPattern = [50, 50, 100];
        break;
      case HapticPattern.WARNING:
        vibrationPattern = [100, 50, 100];
        break;
      case HapticPattern.ERROR:
        vibrationPattern = [200, 100, 200];
        break;
      case HapticPattern.SELECTION:
        vibrationPattern = [25];
        break;
      case HapticPattern.IMPACT:
        vibrationPattern = [150];
        break;
      default:
        vibrationPattern = [50];
    }

    navigator.vibrate(vibrationPattern);
  }

  /**
   * Focus management for better keyboard navigation
   */
  public manageFocus(element: HTMLElement, announcement?: string): void {
    element.focus();

    if (announcement) {
      this.announceToScreenReader(announcement, AnnouncementPriority.POLITE);
    }

    // Ensure focus is visible
    element.scrollIntoView({
      behavior: this.preferences.reduceMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest'
    });
  }

  /**
   * Create accessible label for financial data
   */
  public createFinancialLabel(symbol: string, price: number, change: number, changePercent: number): string {
    const direction = change >= 0 ? 'up' : 'down';
    const changeText = Math.abs(change).toFixed(2);
    const percentText = Math.abs(changePercent).toFixed(2);

    return `${symbol} stock price ${price.toFixed(2)} dollars, ${direction} ${changeText} dollars or ${percentText} percent`;
  }

  /**
   * Handle keyboard shortcuts
   */
  public handleKeyboardShortcut(event: KeyboardEvent): boolean {
    const { key, ctrlKey, metaKey, altKey, shiftKey } = event;
    const modifierKey = ctrlKey || metaKey;

    // Common accessibility shortcuts
    if (modifierKey && key === '/') {
      // Toggle voice navigation
      if (this.preferences.voiceNavigation) {
        this.stopVoiceNavigation();
      } else {
        this.startVoiceNavigation();
      }
      return true;
    }

    if (modifierKey && shiftKey && key === 'A') {
      // Open accessibility menu
      this.announceToScreenReader('Accessibility menu opened', AnnouncementPriority.ASSERTIVE);
      return true;
    }

    if (key === 'Escape') {
      // Cancel current action
      this.speechSynthesis?.cancel();
      this.stopVoiceNavigation();
      return true;
    }

    return false;
  }
}

// React hooks for accessibility

export function useAccessibility() {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>();
  const accessibilityManager = useRef<AccessibilityManager>();

  useEffect(() => {
    accessibilityManager.current = AccessibilityManager.getInstance();
    setPreferences(accessibilityManager.current.getPreferences());
  }, []);

  const updatePreferences = useCallback((newPreferences: Partial<AccessibilityPreferences>) => {
    if (accessibilityManager.current) {
      accessibilityManager.current.savePreferences(newPreferences);
      setPreferences(accessibilityManager.current.getPreferences());
    }
  }, []);

  const announce = useCallback((message: string, priority?: AnnouncementPriority) => {
    accessibilityManager.current?.announceToScreenReader(message, priority);
  }, []);

  const speak = useCallback((text: string, interrupt?: boolean) => {
    accessibilityManager.current?.speak(text, interrupt);
  }, []);

  const triggerHaptic = useCallback((pattern: HapticPattern) => {
    accessibilityManager.current?.triggerHapticFeedback(pattern);
  }, []);

  const manageFocus = useCallback((element: HTMLElement, announcement?: string) => {
    accessibilityManager.current?.manageFocus(element, announcement);
  }, []);

  return {
    preferences,
    updatePreferences,
    announce,
    speak,
    triggerHaptic,
    manageFocus,
    accessibilityManager: accessibilityManager.current
  };
}

export function useVoiceCommands(commands: VoiceCommand[]) {
  const { accessibilityManager } = useAccessibility();

  useEffect(() => {
    if (!accessibilityManager) return;

    // Register all commands
    commands.forEach(command => {
      accessibilityManager.registerVoiceCommand(command);
    });

    // Cleanup function would need to be implemented to unregister commands
    return () => {
      // Commands cleanup implementation
    };
  }, [accessibilityManager, commands]);
}

export function useKeyboardNavigation(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const accessibilityManager = AccessibilityManager.getInstance();

      // Let accessibility manager handle its shortcuts first
      if (accessibilityManager.handleKeyboardShortcut(event)) {
        event.preventDefault();
        return;
      }

      // Handle custom shortcuts
      const shortcutKey = [
        event.ctrlKey || event.metaKey ? 'ctrl' : '',
        event.shiftKey ? 'shift' : '',
        event.altKey ? 'alt' : '',
        event.key.toLowerCase()
      ].filter(Boolean).join('+');

      const action = shortcuts[shortcutKey];
      if (action) {
        event.preventDefault();
        action();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Export singleton instance
export const accessibilityManager = AccessibilityManager.getInstance();