/**
 * Mobile Keyboard Provider Component
 * Provides keyboard-aware layout and input management for mobile devices
 */

import React, { useEffect, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useVirtualKeyboard,
  useKeyboardAwareLayout,
  useMobileKeyboardNavigation,
  type FocusableElement
} from '../../utils/mobileKeyboard';

interface MobileKeyboardProviderProps {
  children: ReactNode;
  className?: string;
  enableKeyboardNavigation?: boolean;
  focusGroup?: string;
  adjustLayout?: boolean;
}

export const MobileKeyboardProvider: React.FC<MobileKeyboardProviderProps> = ({
  children,
  className = '',
  enableKeyboardNavigation = true,
  focusGroup = 'default',
  adjustLayout = true
}) => {
  const keyboardState = useVirtualKeyboard();
  const { layoutAdjustment, isKeyboardVisible } = useKeyboardAwareLayout();
  const containerRef = useRef<HTMLDivElement>(null);

  // Collect focusable elements for keyboard navigation
  const focusableElements: FocusableElement[] = React.useMemo(() => {
    if (!containerRef.current) return [];

    const elements = containerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [data-focusable]'
    );

    return Array.from(elements).map((element, index) => ({
      element,
      priority: parseInt(element.getAttribute('data-focus-priority') || String(index)),
      group: element.getAttribute('data-focus-group') || focusGroup,
      skipOnMobile: element.hasAttribute('data-skip-mobile-focus')
    }));
  }, [focusGroup, children]);

  // Set up keyboard navigation
  useMobileKeyboardNavigation(focusGroup, focusableElements);

  // Apply layout adjustments when keyboard is visible
  const containerStyles = adjustLayout && isKeyboardVisible ? {
    paddingBottom: `${layoutAdjustment.paddingBottom}px`,
    transform: layoutAdjustment.transform,
    transition: 'transform 0.3s ease-out, padding-bottom 0.3s ease-out'
  } : {};

  return (
    <div
      ref={containerRef}
      className={`mobile-keyboard-container ${className}`}
      style={containerStyles}
      data-keyboard-visible={isKeyboardVisible}
      data-keyboard-height={keyboardState.height}
      data-testid="mobile-keyboard-provider"
    >
      {children}

      {/* Keyboard State Indicator (for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <KeyboardDebugInfo keyboardState={keyboardState} />
      )}

      {/* Keyboard Navigation Hints */}
      <AnimatePresence>
        {enableKeyboardNavigation && isKeyboardVisible && (
          <KeyboardNavigationHints />
        )}
      </AnimatePresence>
    </div>
  );
};

// Keyboard Debug Information Component
interface KeyboardDebugInfoProps {
  keyboardState: any;
}

const KeyboardDebugInfo: React.FC<KeyboardDebugInfoProps> = ({ keyboardState }) => {
  if (!keyboardState.isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-black/80 text-white text-xs p-2 rounded">
      <div>Keyboard: {keyboardState.isVisible ? 'Visible' : 'Hidden'}</div>
      <div>Height: {keyboardState.height}px</div>
      <div>Type: {keyboardState.type}</div>
      <div>Input Mode: {keyboardState.inputMode}</div>
    </div>
  );
};

// Keyboard Navigation Hints Component
const KeyboardNavigationHints: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 left-4 right-4 bg-primary-600 text-white text-xs p-3 rounded-lg shadow-lg"
      data-testid="keyboard-navigation-hints"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-medium mb-1">Keyboard Navigation</div>
          <div className="opacity-90">
            Tab/↕️ Navigate • Enter: Select • Esc: Close
          </div>
        </div>
        <div className="text-lg">⌨️</div>
      </div>
    </motion.div>
  );
};

// Enhanced Input Component with Mobile Keyboard Support
interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  keyboardConfig?: 'email' | 'password' | 'numeric' | 'decimal' | 'search' | 'phone' | 'text';
  autoAdjustScroll?: boolean;
  focusPriority?: number;
  focusGroup?: string;
}

export const MobileInput: React.FC<MobileInputProps> = ({
  label,
  error,
  keyboardConfig = 'text',
  autoAdjustScroll = true,
  focusPriority = 0,
  focusGroup = 'default',
  className = '',
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboardState = useVirtualKeyboard();

  // Configure input for mobile keyboard
  useEffect(() => {
    if (!inputRef.current) return;

    const input = inputRef.current;
    const configs = {
      email: {
        inputMode: 'email',
        enterKeyHint: 'next',
        autoComplete: 'email',
        autoCorrect: 'off',
        autoCapitalize: 'off',
        spellCheck: false
      },
      password: {
        inputMode: 'text',
        enterKeyHint: 'done',
        autoComplete: 'current-password',
        autoCorrect: 'off',
        autoCapitalize: 'off',
        spellCheck: false
      },
      numeric: {
        inputMode: 'numeric',
        enterKeyHint: 'done',
        autoComplete: 'off',
        autoCorrect: 'off',
        autoCapitalize: 'off',
        spellCheck: false
      },
      decimal: {
        inputMode: 'decimal',
        enterKeyHint: 'done',
        autoComplete: 'off',
        autoCorrect: 'off',
        autoCapitalize: 'off',
        spellCheck: false
      },
      search: {
        inputMode: 'search',
        enterKeyHint: 'search',
        autoComplete: 'off',
        autoCorrect: 'on',
        autoCapitalize: 'sentences',
        spellCheck: true
      },
      phone: {
        inputMode: 'tel',
        enterKeyHint: 'done',
        autoComplete: 'tel',
        autoCorrect: 'off',
        autoCapitalize: 'off',
        spellCheck: false
      },
      text: {
        inputMode: 'text',
        enterKeyHint: 'next',
        autoComplete: 'on',
        autoCorrect: 'on',
        autoCapitalize: 'sentences',
        spellCheck: true
      }
    };

    const config = configs[keyboardConfig];
    Object.entries(config).forEach(([key, value]) => {
      if (key === 'inputMode') {
        input.setAttribute('inputmode', value as string);
      } else if (key === 'enterKeyHint') {
        input.setAttribute('enterkeyhint', value as string);
      } else if (key === 'autoComplete') {
        input.setAttribute('autocomplete', value as string);
      } else if (key === 'autoCorrect') {
        input.setAttribute('autocorrect', value as string);
      } else if (key === 'autoCapitalize') {
        input.setAttribute('autocapitalize', value as string);
      } else if (key === 'spellCheck') {
        input.setAttribute('spellcheck', String(value));
      }
    });
  }, [keyboardConfig]);

  // Auto-scroll into view when keyboard appears
  useEffect(() => {
    if (!autoAdjustScroll || !inputRef.current || !keyboardState.isVisible) return;

    const input = inputRef.current;
    if (document.activeElement === input) {
      setTimeout(() => {
        input.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 300);
    }
  }, [keyboardState.isVisible, autoAdjustScroll]);

  return (
    <div className="mobile-input-wrapper">
      {label && (
        <label
          htmlFor={props.id}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        className={`
          block w-full px-3 py-3 border border-gray-300 dark:border-gray-600
          rounded-lg shadow-sm bg-white dark:bg-gray-800
          text-gray-900 dark:text-white
          focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          placeholder-gray-400 dark:placeholder-gray-500
          text-base
          ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        data-focus-priority={focusPriority}
        data-focus-group={focusGroup}
        data-testid="mobile-input"
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400" data-testid="input-error">
          {error}
        </p>
      )}
    </div>
  );
};

// Mobile Keyboard Aware Button Component
interface MobileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  focusPriority?: number;
  focusGroup?: string;
  hapticFeedback?: boolean;
}

export const MobileButton: React.FC<MobileButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  focusPriority = 0,
  focusGroup = 'default',
  hapticFeedback = true,
  className = '',
  onClick,
  ...props
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-3 text-base min-h-[44px]',
    lg: 'px-6 py-4 text-lg min-h-[52px]'
  };

  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-white',
    ghost: 'bg-transparent text-primary-600 hover:bg-primary-50 focus:ring-primary-500 dark:text-primary-400'
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Trigger haptic feedback on mobile
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }

    onClick?.(event);
  };

  return (
    <button
      ref={buttonRef}
      className={`
        inline-flex items-center justify-center rounded-lg font-medium
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      data-focus-priority={focusPriority}
      data-focus-group={focusGroup}
      data-testid="mobile-button"
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};

// Mobile Form Component with Keyboard Navigation
interface MobileFormProps {
  children: ReactNode;
  onSubmit?: (event: React.FormEvent) => void;
  focusGroup?: string;
  autoAdjustLayout?: boolean;
  className?: string;
}

export const MobileForm: React.FC<MobileFormProps> = ({
  children,
  onSubmit,
  focusGroup = 'form',
  autoAdjustLayout = true,
  className = ''
}) => {
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit?.(event);

    // Hide keyboard after form submission
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  return (
    <MobileKeyboardProvider
      focusGroup={focusGroup}
      adjustLayout={autoAdjustLayout}
      className={className}
    >
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="mobile-form"
        data-testid="mobile-form"
      >
        {children}
      </form>
    </MobileKeyboardProvider>
  );
};