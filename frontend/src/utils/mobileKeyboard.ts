/**
 * Mobile Keyboard Support Utilities
 * Comprehensive keyboard handling for mobile devices including virtual keyboards
 */

import { useEffect, useCallback, useRef, useState } from 'react';

// Virtual keyboard types
export enum KeyboardType {
  DEFAULT = 'default',
  NUMERIC = 'numeric',
  DECIMAL = 'decimal',
  EMAIL = 'email',
  URL = 'url',
  SEARCH = 'search',
  TEL = 'tel'
}

// Virtual keyboard state
export interface VirtualKeyboardState {
  isVisible: boolean;
  height: number;
  type: KeyboardType;
  inputMode: string;
}

// Mobile keyboard configuration
export interface MobileKeyboardConfig {
  inputMode: string;
  enterKeyHint: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
  autocomplete: string;
  autocorrect: 'on' | 'off';
  autocapitalize: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
  spellcheck: boolean;
}

// Focus management for keyboard navigation
export interface FocusableElement {
  element: HTMLElement;
  priority: number;
  group: string;
  skipOnMobile?: boolean;
}

export class MobileKeyboardManager {
  private static instance: MobileKeyboardManager;
  private keyboardState: VirtualKeyboardState;
  private listeners: Set<(state: VirtualKeyboardState) => void> = new Set();
  private focusableElements: Map<string, FocusableElement[]> = new Map();
  private currentFocusGroup: string = 'default';
  private initialViewportHeight: number;
  private resizeObserver: ResizeObserver | null = null;

  private constructor() {
    this.keyboardState = {
      isVisible: false,
      height: 0,
      type: KeyboardType.DEFAULT,
      inputMode: 'none'
    };
    this.initialViewportHeight = window.innerHeight;
    this.initializeKeyboardDetection();
  }

  public static getInstance(): MobileKeyboardManager {
    if (!MobileKeyboardManager.instance) {
      MobileKeyboardManager.instance = new MobileKeyboardManager();
    }
    return MobileKeyboardManager.instance;
  }

  /**
   * Initialize virtual keyboard detection
   */
  private initializeKeyboardDetection(): void {
    // Visual Viewport API (modern approach)
    if ('visualViewport' in window) {
      const visualViewport = window.visualViewport!;

      visualViewport.addEventListener('resize', () => {
        this.updateKeyboardState();
      });
    }

    // Fallback: Window resize detection
    window.addEventListener('resize', () => {
      this.updateKeyboardState();
    });

    // Focus/blur events for input elements
    document.addEventListener('focusin', (event) => {
      if (this.isInputElement(event.target as Element)) {
        this.handleInputFocus(event.target as HTMLInputElement);
      }
    });

    document.addEventListener('focusout', (event) => {
      if (this.isInputElement(event.target as Element)) {
        this.handleInputBlur();
      }
    });

    // ResizeObserver for more accurate detection
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateKeyboardState();
      });
      this.resizeObserver.observe(document.documentElement);
    }
  }

  /**
   * Update keyboard state based on viewport changes
   */
  private updateKeyboardState(): void {
    const currentHeight = this.getCurrentViewportHeight();
    const heightDifference = this.initialViewportHeight - currentHeight;
    const threshold = 150; // Minimum height change to consider keyboard visible

    const newState: VirtualKeyboardState = {
      ...this.keyboardState,
      isVisible: heightDifference > threshold,
      height: Math.max(0, heightDifference)
    };

    if (this.hasStateChanged(newState)) {
      this.keyboardState = newState;
      this.notifyListeners();
    }
  }

  /**
   * Get current viewport height
   */
  private getCurrentViewportHeight(): number {
    if ('visualViewport' in window) {
      return window.visualViewport!.height;
    }
    return window.innerHeight;
  }

  /**
   * Check if keyboard state has changed
   */
  private hasStateChanged(newState: VirtualKeyboardState): boolean {
    return (
      this.keyboardState.isVisible !== newState.isVisible ||
      Math.abs(this.keyboardState.height - newState.height) > 10
    );
  }

  /**
   * Check if element is an input element
   */
  private isInputElement(element: Element): boolean {
    if (!element) return false;

    const tagName = element.tagName.toLowerCase();
    const inputTypes = ['input', 'textarea', 'select'];

    return inputTypes.includes(tagName) || element.hasAttribute('contenteditable');
  }

  /**
   * Handle input element focus
   */
  private handleInputFocus(input: HTMLInputElement): void {
    const inputType = this.getInputType(input);
    const inputMode = input.getAttribute('inputmode') || 'text';

    this.keyboardState = {
      ...this.keyboardState,
      type: inputType,
      inputMode
    };

    // Scroll input into view after a short delay
    setTimeout(() => {
      this.scrollInputIntoView(input);
    }, 300);
  }

  /**
   * Handle input element blur
   */
  private handleInputBlur(): void {
    // Reset keyboard state when no input is focused
    setTimeout(() => {
      if (!document.activeElement || !this.isInputElement(document.activeElement)) {
        this.keyboardState = {
          ...this.keyboardState,
          type: KeyboardType.DEFAULT,
          inputMode: 'none'
        };
      }
    }, 100);
  }

  /**
   * Get input type from element
   */
  private getInputType(input: HTMLInputElement): KeyboardType {
    const type = input.type?.toLowerCase();
    const inputMode = input.getAttribute('inputmode');

    if (inputMode === 'numeric' || type === 'number') return KeyboardType.NUMERIC;
    if (inputMode === 'decimal') return KeyboardType.DECIMAL;
    if (type === 'email') return KeyboardType.EMAIL;
    if (type === 'url') return KeyboardType.URL;
    if (type === 'search') return KeyboardType.SEARCH;
    if (type === 'tel') return KeyboardType.TEL;

    return KeyboardType.DEFAULT;
  }

  /**
   * Scroll input into view when keyboard appears
   */
  private scrollInputIntoView(input: HTMLInputElement): void {
    const rect = input.getBoundingClientRect();
    const viewportHeight = this.getCurrentViewportHeight();
    const keyboardHeight = this.keyboardState.height;
    const availableSpace = viewportHeight - keyboardHeight;
    const inputBottom = rect.bottom;

    if (inputBottom > availableSpace - 50) { // 50px buffer
      const scrollAmount = inputBottom - availableSpace + 100; // Extra space
      window.scrollBy({
        top: scrollAmount,
        behavior: 'smooth'
      });
    }
  }

  /**
   * Subscribe to keyboard state changes
   */
  public subscribe(callback: (state: VirtualKeyboardState) => void): () => void {
    this.listeners.add(callback);

    // Send current state immediately
    callback(this.keyboardState);

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.keyboardState));
  }

  /**
   * Get current keyboard state
   */
  public getState(): VirtualKeyboardState {
    return { ...this.keyboardState };
  }

  /**
   * Register focusable elements for keyboard navigation
   */
  public registerFocusableElements(group: string, elements: FocusableElement[]): void {
    this.focusableElements.set(group, elements.sort((a, b) => a.priority - b.priority));
  }

  /**
   * Set current focus group
   */
  public setFocusGroup(group: string): void {
    this.currentFocusGroup = group;
  }

  /**
   * Navigate to next focusable element
   */
  public focusNext(): boolean {
    const elements = this.focusableElements.get(this.currentFocusGroup);
    if (!elements || elements.length === 0) return false;

    const currentIndex = this.getCurrentFocusIndex(elements);
    const nextIndex = (currentIndex + 1) % elements.length;

    return this.focusElement(elements[nextIndex]);
  }

  /**
   * Navigate to previous focusable element
   */
  public focusPrevious(): boolean {
    const elements = this.focusableElements.get(this.currentFocusGroup);
    if (!elements || elements.length === 0) return false;

    const currentIndex = this.getCurrentFocusIndex(elements);
    const prevIndex = currentIndex === 0 ? elements.length - 1 : currentIndex - 1;

    return this.focusElement(elements[prevIndex]);
  }

  /**
   * Get current focus index
   */
  private getCurrentFocusIndex(elements: FocusableElement[]): number {
    const activeElement = document.activeElement;
    return elements.findIndex(item => item.element === activeElement);
  }

  /**
   * Focus specific element
   */
  private focusElement(focusableElement: FocusableElement): boolean {
    if (focusableElement.skipOnMobile && this.isMobileDevice()) {
      return false;
    }

    try {
      focusableElement.element.focus();
      return true;
    } catch (error) {
      console.warn('Failed to focus element:', error);
      return false;
    }
  }

  /**
   * Check if device is mobile
   */
  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Configure input for optimal mobile experience
   */
  public configureInput(input: HTMLInputElement, config: Partial<MobileKeyboardConfig>): void {
    if (config.inputMode) {
      input.setAttribute('inputmode', config.inputMode);
    }

    if (config.enterKeyHint) {
      input.setAttribute('enterkeyhint', config.enterKeyHint);
    }

    if (config.autocomplete) {
      input.setAttribute('autocomplete', config.autocomplete);
    }

    if (config.autocorrect) {
      input.setAttribute('autocorrect', config.autocorrect);
    }

    if (config.autocapitalize) {
      input.setAttribute('autocapitalize', config.autocapitalize);
    }

    if (typeof config.spellcheck === 'boolean') {
      input.setAttribute('spellcheck', config.spellcheck.toString());
    }
  }

  /**
   * Handle virtual keyboard navigation
   */
  public handleKeyboardNavigation(event: KeyboardEvent): boolean {
    const { key, target } = event;

    // Only handle navigation keys
    if (!['Tab', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(key)) {
      return false;
    }

    // Skip if target is an input element (let it handle normally)
    if (this.isInputElement(target as Element)) {
      return false;
    }

    switch (key) {
      case 'Tab':
        event.preventDefault();
        return event.shiftKey ? this.focusPrevious() : this.focusNext();

      case 'ArrowDown':
        event.preventDefault();
        return this.focusNext();

      case 'ArrowUp':
        event.preventDefault();
        return this.focusPrevious();

      case 'Enter':
        if (document.activeElement) {
          (document.activeElement as HTMLElement).click();
          return true;
        }
        return false;

      case 'Escape':
        if (document.activeElement) {
          (document.activeElement as HTMLElement).blur();
          return true;
        }
        return false;

      default:
        return false;
    }
  }
}

// React hooks for mobile keyboard support

export function useVirtualKeyboard() {
  const [keyboardState, setKeyboardState] = useState<VirtualKeyboardState>({
    isVisible: false,
    height: 0,
    type: KeyboardType.DEFAULT,
    inputMode: 'none'
  });

  useEffect(() => {
    const manager = MobileKeyboardManager.getInstance();
    return manager.subscribe(setKeyboardState);
  }, []);

  return keyboardState;
}

export function useMobileKeyboardNavigation(
  focusGroup: string,
  elements: FocusableElement[]
) {
  const managerRef = useRef<MobileKeyboardManager>();

  useEffect(() => {
    managerRef.current = MobileKeyboardManager.getInstance();
    managerRef.current.registerFocusableElements(focusGroup, elements);
    managerRef.current.setFocusGroup(focusGroup);
  }, [focusGroup, elements]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (managerRef.current) {
        managerRef.current.handleKeyboardNavigation(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    focusNext: () => managerRef.current?.focusNext(),
    focusPrevious: () => managerRef.current?.focusPrevious()
  };
}

export function useMobileInput(config: Partial<MobileKeyboardConfig> = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const manager = useRef<MobileKeyboardManager>();

  useEffect(() => {
    manager.current = MobileKeyboardManager.getInstance();
  }, []);

  const configureInput = useCallback(() => {
    if (inputRef.current && manager.current) {
      manager.current.configureInput(inputRef.current, config);
    }
  }, [config]);

  useEffect(() => {
    configureInput();
  }, [configureInput]);

  return {
    inputRef,
    configureInput
  };
}

export function useKeyboardAwareLayout() {
  const keyboardState = useVirtualKeyboard();
  const [layoutAdjustment, setLayoutAdjustment] = useState<{
    paddingBottom: number;
    transform: string;
  }>({
    paddingBottom: 0,
    transform: 'none'
  });

  useEffect(() => {
    if (keyboardState.isVisible) {
      setLayoutAdjustment({
        paddingBottom: keyboardState.height,
        transform: `translateY(-${keyboardState.height / 4}px)`
      });
    } else {
      setLayoutAdjustment({
        paddingBottom: 0,
        transform: 'none'
      });
    }
  }, [keyboardState.isVisible, keyboardState.height]);

  return {
    keyboardState,
    layoutAdjustment,
    isKeyboardVisible: keyboardState.isVisible
  };
}

// Common mobile input configurations
export const MobileInputConfigs = {
  email: {
    inputMode: 'email',
    enterKeyHint: 'next',
    autocomplete: 'email',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: false
  } as MobileKeyboardConfig,

  password: {
    inputMode: 'text',
    enterKeyHint: 'done',
    autocomplete: 'current-password',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: false
  } as MobileKeyboardConfig,

  numeric: {
    inputMode: 'numeric',
    enterKeyHint: 'done',
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: false
  } as MobileKeyboardConfig,

  decimal: {
    inputMode: 'decimal',
    enterKeyHint: 'done',
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: false
  } as MobileKeyboardConfig,

  search: {
    inputMode: 'search',
    enterKeyHint: 'search',
    autocomplete: 'off',
    autocorrect: 'on',
    autocapitalize: 'sentences',
    spellcheck: true
  } as MobileKeyboardConfig,

  phone: {
    inputMode: 'tel',
    enterKeyHint: 'done',
    autocomplete: 'tel',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: false
  } as MobileKeyboardConfig,

  text: {
    inputMode: 'text',
    enterKeyHint: 'next',
    autocomplete: 'on',
    autocorrect: 'on',
    autocapitalize: 'sentences',
    spellcheck: true
  } as MobileKeyboardConfig
};

// Export singleton instance
export const mobileKeyboardManager = MobileKeyboardManager.getInstance();