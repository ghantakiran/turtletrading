import React from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost' | 'gradient';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  ripple?: boolean;
  glow?: boolean;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  ripple = true,
  glow = false,
  disabled,
  className = '',
  children,
  onClick,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return `
          bg-gradient-to-r from-primary-500 to-primary-600 text-white
          hover:from-primary-600 hover:to-primary-700
          ${glow ? 'shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40' : ''}
        `;
      case 'secondary':
        return `
          bg-gradient-to-r from-secondary-100 to-secondary-200 text-secondary-900
          hover:from-secondary-200 hover:to-secondary-300
          ${glow ? 'shadow-lg shadow-secondary-500/25 hover:shadow-secondary-500/40' : ''}
        `;
      case 'success':
        return `
          bg-gradient-to-r from-success-500 to-success-600 text-white
          hover:from-success-600 hover:to-success-700
          ${glow ? 'shadow-lg shadow-success-500/25 hover:shadow-success-500/40' : ''}
        `;
      case 'warning':
        return `
          bg-gradient-to-r from-warning-500 to-warning-600 text-white
          hover:from-warning-600 hover:to-warning-700
          ${glow ? 'shadow-lg shadow-warning-500/25 hover:shadow-warning-500/40' : ''}
        `;
      case 'error':
        return `
          bg-gradient-to-r from-error-500 to-error-600 text-white
          hover:from-error-600 hover:to-error-700
          ${glow ? 'shadow-lg shadow-error-500/25 hover:shadow-error-500/40' : ''}
        `;
      case 'ghost':
        return `
          bg-transparent text-secondary-700 hover:bg-secondary-100
          border border-secondary-300 hover:border-secondary-400
        `;
      case 'gradient':
        return `
          bg-gradient-to-r from-bull-500 via-primary-500 to-bear-500 text-white
          hover:from-bull-600 hover:via-primary-600 hover:to-bear-600
          ${glow ? 'shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40' : ''}
        `;
      default:
        return '';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'md':
        return 'px-4 py-2 text-sm';
      case 'lg':
        return 'px-6 py-3 text-base';
      case 'xl':
        return 'px-8 py-4 text-lg';
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (ripple && !disabled) {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const rippleX = e.clientX - rect.left;
      const rippleY = e.clientY - rect.top;

      // Create ripple effect
      const rippleElement = document.createElement('span');
      rippleElement.className = 'absolute rounded-full animate-ping bg-white/30';
      rippleElement.style.left = `${rippleX}px`;
      rippleElement.style.top = `${rippleY}px`;
      rippleElement.style.width = '2px';
      rippleElement.style.height = '2px';
      rippleElement.style.transform = 'translate(-50%, -50%)';

      button.appendChild(rippleElement);

      setTimeout(() => {
        rippleElement.remove();
      }, 600);
    }

    if (onClick && !disabled && !isLoading) {
      onClick(e);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`
        relative overflow-hidden inline-flex items-center justify-center
        font-semibold rounded-lg transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
        ${getVariantStyles()}
        ${getSizeStyles()}
        ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      disabled={disabled || isLoading}
      onClick={handleClick}
      {...props}
    >
      {/* Loading spinner */}
      {isLoading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="mr-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
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
        </motion.div>
      )}

      {/* Left icon */}
      {leftIcon && !isLoading && (
        <motion.span
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          className="mr-2"
        >
          {leftIcon}
        </motion.span>
      )}

      {/* Button content */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {children}
      </motion.span>

      {/* Right icon */}
      {rightIcon && !isLoading && (
        <motion.span
          initial={{ opacity: 0, x: 5 }}
          animate={{ opacity: 1, x: 0 }}
          className="ml-2"
        >
          {rightIcon}
        </motion.span>
      )}

      {/* Gradient animation on hover */}
      {variant === 'gradient' && (
        <motion.div
          initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
      )}

      {/* Shine effect for primary buttons */}
      {(variant === 'primary' || variant === 'success') && (
        <motion.div
          initial={{ x: '-100%', opacity: 0 }}
          whileHover={{ x: '100%', opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform skew-x-12"
        />
      )}
    </motion.button>
  );
};

export default Button;