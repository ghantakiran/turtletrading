import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';

// Accessibility utilities and hooks for sentiment components

/**
 * Custom hook for managing keyboard navigation in list components
 */
export const useKeyboardNavigation = (
  items: any[],
  onItemSelect?: (item: any, index: number) => void,
  options: {
    loop?: boolean;
    disabled?: boolean;
    initialIndex?: number;
  } = {}
) => {
  const { loop = true, disabled = false, initialIndex = 0 } = options;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Update refs array when items change
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items.length]);

  // Focus management
  const focusItem = useCallback((index: number) => {
    const item = itemRefs.current[index];
    if (item) {
      item.focus();
    }
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: KeyboardEvent, contextIndex?: number) => {
    if (disabled) return;

    const startIndex = contextIndex ?? currentIndex;
    let newIndex = startIndex;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        newIndex = startIndex + 1;
        if (newIndex >= items.length) {
          newIndex = loop ? 0 : items.length - 1;
        }
        break;

      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = startIndex - 1;
        if (newIndex < 0) {
          newIndex = loop ? items.length - 1 : 0;
        }
        break;

      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        newIndex = items.length - 1;
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (onItemSelect && items[startIndex]) {
          onItemSelect(items[startIndex], startIndex);
        }
        return;

      default:
        return;
    }

    setCurrentIndex(newIndex);
    focusItem(newIndex);
  }, [currentIndex, disabled, items, loop, onItemSelect, focusItem]);

  // Set ref for an item
  const setItemRef = useCallback((index: number) => (ref: HTMLElement | null) => {
    itemRefs.current[index] = ref;
  }, []);

  return {
    currentIndex,
    setCurrentIndex,
    handleKeyDown,
    setItemRef,
    focusItem
  };
};

/**
 * Custom hook for screen reader announcements
 */
export const useScreenReader = () => {
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Add announcement
    setAnnouncements(prev => [...prev, message]);

    // Remove announcement after it's been read
    timeoutRef.current = setTimeout(() => {
      setAnnouncements(prev => prev.slice(1));
    }, priority === 'assertive' ? 1000 : 3000);
  }, []);

  const ScreenReaderAnnouncements = () => (
    <div
      className="sr-only"
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      {announcements.map((announcement, index) => (
        <div key={index}>{announcement}</div>
      ))}
    </div>
  );

  return { announce, ScreenReaderAnnouncements };
};

/**
 * Custom hook for managing focus trap in modals/dialogs
 */
export const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Store previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first element
    if (firstElement) {
      firstElement.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // Restore focus when component unmounts or becomes inactive
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive]);

  return containerRef;
};

/**
 * Accessible button component with proper ARIA attributes
 */
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = 'Loading...',
  disabled,
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-muted hover:text-muted-foreground'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="sr-only">{loadingText}</span>
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
};

/**
 * Accessible input component with proper labeling
 */
interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
  required?: boolean;
}

export const AccessibleInput: React.FC<AccessibleInputProps> = ({
  label,
  error,
  helpText,
  required,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const helpId = helpText ? `${inputId}-help` : undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
      </label>

      <input
        id={inputId}
        className={`w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
          error ? 'border-red-500' : ''
        } ${className}`}
        aria-invalid={!!error}
        aria-describedby={[errorId, helpId].filter(Boolean).join(' ') || undefined}
        required={required}
        {...props}
      />

      {helpText && (
        <p id={helpId} className="text-sm text-muted-foreground">
          {helpText}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Accessible select component with proper ARIA attributes
 */
interface AccessibleSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string; disabled?: boolean }[];
  error?: string;
  helpText?: string;
  required?: boolean;
}

export const AccessibleSelect: React.FC<AccessibleSelectProps> = ({
  label,
  options,
  error,
  helpText,
  required,
  id,
  className = '',
  ...props
}) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${selectId}-error` : undefined;
  const helpId = helpText ? `${selectId}-help` : undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={selectId}
        className="block text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
      </label>

      <select
        id={selectId}
        className={`w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
          error ? 'border-red-500' : ''
        } ${className}`}
        aria-invalid={!!error}
        aria-describedby={[errorId, helpId].filter(Boolean).join(' ') || undefined}
        required={required}
        {...props}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>

      {helpText && (
        <p id={helpId} className="text-sm text-muted-foreground">
          {helpText}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Skip to content link for keyboard navigation
 */
export const SkipToContent: React.FC = () => {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-primary text-primary-foreground px-4 py-2 z-50 focus:outline-none focus:ring-2 focus:ring-primary-foreground"
    >
      Skip to main content
    </a>
  );
};

/**
 * Accessible progress indicator
 */
interface AccessibleProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export const AccessibleProgress: React.FC<AccessibleProgressProps> = ({
  value,
  max = 100,
  label,
  showValue = true,
  className = ''
}) => {
  const percentage = Math.round((value / max) * 100);

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          {showValue && <span>{percentage}%</span>}
        </div>
      )}
      <div
        className="w-full bg-muted rounded-full h-2"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || `Progress: ${percentage}%`}
      >
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Accessible tooltip component
 */
interface AccessibleTooltipProps {
  content: string;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export const AccessibleTooltip: React.FC<AccessibleTooltipProps> = ({
  content,
  children,
  placement = 'top'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;

  const placementClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  };

  return (
    <div className="relative inline-block">
      {React.cloneElement(children, {
        'aria-describedby': tooltipId,
        onMouseEnter: () => setIsVisible(true),
        onMouseLeave: () => setIsVisible(false),
        onFocus: () => setIsVisible(true),
        onBlur: () => setIsVisible(false)
      })}

      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute z-50 px-2 py-1 text-sm text-white bg-gray-900 rounded shadow-lg whitespace-nowrap ${placementClasses[placement]}`}
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${
              placement === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1' :
              placement === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1' :
              placement === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1' :
              'right-full top-1/2 -translate-y-1/2 -mr-1'
            }`}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Live region for dynamic content updates
 */
interface LiveRegionProps {
  children: React.ReactNode;
  priority?: 'polite' | 'assertive';
  atomic?: boolean;
  className?: string;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  children,
  priority = 'polite',
  atomic = true,
  className = ''
}) => {
  return (
    <div
      className={`sr-only ${className}`}
      aria-live={priority}
      aria-atomic={atomic}
      role="status"
    >
      {children}
    </div>
  );
};

/**
 * Utility function to generate accessible IDs
 */
export const generateId = (prefix: string = 'id'): string => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Utility function to format numbers for screen readers
 */
export const formatNumberForScreenReader = (
  value: number,
  options: {
    type?: 'currency' | 'percentage' | 'decimal';
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string => {
  const { type = 'decimal', currency = 'USD', minimumFractionDigits = 0, maximumFractionDigits = 2 } = options;

  if (type === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits
    }).format(value);
  }

  if (type === 'percentage') {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits,
      maximumFractionDigits
    }).format(value / 100);
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(value);
};

/**
 * Utility function to create accessible descriptions for sentiment data
 */
export const createSentimentDescription = (
  score: number,
  confidence?: number,
  mentions?: number
): string => {
  let sentiment = 'neutral';
  if (score >= 0.3) sentiment = 'positive';
  else if (score >= 0.1) sentiment = 'slightly positive';
  else if (score <= -0.3) sentiment = 'negative';
  else if (score <= -0.1) sentiment = 'slightly negative';

  let description = `Sentiment: ${sentiment} with a score of ${score.toFixed(2)}`;

  if (confidence !== undefined) {
    description += `, confidence level ${(confidence * 100).toFixed(0)} percent`;
  }

  if (mentions !== undefined) {
    description += `, based on ${mentions} mention${mentions !== 1 ? 's' : ''}`;
  }

  return description;
};