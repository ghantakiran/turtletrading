import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error' | 'gradient';
  showValue?: boolean;
  animated?: boolean;
  striped?: boolean;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showValue = false,
  animated = true,
  striped = false,
  className = ''
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'h-2';
      case 'md':
        return 'h-3';
      case 'lg':
        return 'h-4';
      default:
        return 'h-3';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'from-success-400 to-success-600';
      case 'warning':
        return 'from-warning-400 to-warning-600';
      case 'error':
        return 'from-error-400 to-error-600';
      case 'gradient':
        return 'from-bull-400 via-primary-500 to-bear-400';
      default:
        return 'from-primary-400 to-primary-600';
    }
  };

  const getGlowColor = () => {
    switch (variant) {
      case 'success':
        return 'shadow-success-500/30';
      case 'warning':
        return 'shadow-warning-500/30';
      case 'error':
        return 'shadow-error-500/30';
      case 'gradient':
        return 'shadow-primary-500/30';
      default:
        return 'shadow-primary-500/30';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Progress background */}
      <div className={`
        w-full bg-secondary-200 rounded-full overflow-hidden
        ${getSizeStyles()}
      `}>
        {/* Progress fill */}
        <motion.div
          className={`
            h-full rounded-full relative overflow-hidden
            bg-gradient-to-r ${getVariantStyles()}
            ${animated ? `shadow-lg ${getGlowColor()}` : ''}
            ${striped ? 'bg-striped' : ''}
          `}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{
            duration: 1.2,
            ease: [0.4, 0.0, 0.2, 1]
          }}
        >
          {/* Striped pattern */}
          {striped && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:20px_20px] animate-slide-right" />
          )}

          {/* Animated shine effect */}
          {animated && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: 'loop',
                ease: 'linear'
              }}
            />
          )}

          {/* Pulse effect at the end */}
          {animated && percentage > 0 && (
            <motion.div
              className="absolute right-0 top-0 bottom-0 w-1 bg-white/50"
              animate={{
                opacity: [0.5, 1, 0.5],
                scaleX: [1, 1.5, 1]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          )}
        </motion.div>
      </div>

      {/* Value display */}
      {showValue && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute -top-8 left-0 text-sm font-semibold text-secondary-700"
        >
          <motion.span
            key={percentage}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {Math.round(percentage)}%
          </motion.span>
        </motion.div>
      )}

      {/* Floating percentage indicator */}
      {animated && percentage > 10 && (
        <motion.div
          className="absolute top-1/2 transform -translate-y-1/2 bg-white/90 text-xs px-2 py-1 rounded-full shadow-lg font-semibold"
          style={{ left: `${Math.min(percentage - 8, 90)}%` }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
        >
          {Math.round(percentage)}%
        </motion.div>
      )}
    </div>
  );
};

// Circular Progress Component
interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'gradient';
  showValue?: boolean;
  animated?: boolean;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  variant = 'default',
  showValue = true,
  animated = true,
  className = ''
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const getStrokeColor = () => {
    switch (variant) {
      case 'success':
        return 'stroke-success-500';
      case 'warning':
        return 'stroke-warning-500';
      case 'error':
        return 'stroke-error-500';
      case 'gradient':
        return 'stroke-primary-500';
      default:
        return 'stroke-primary-500';
    }
  };

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-secondary-200"
        />

        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          className={`${getStrokeColor()} drop-shadow-lg`}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset
          }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{
            duration: 1.5,
            ease: [0.4, 0.0, 0.2, 1]
          }}
        />
      </svg>

      {/* Center value */}
      {showValue && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="text-2xl font-bold text-secondary-700">
            {Math.round(percentage)}%
          </span>
        </motion.div>
      )}

      {/* Animated dot at progress end */}
      {animated && percentage > 0 && (
        <motion.div
          className={`absolute w-3 h-3 rounded-full ${
            variant === 'success' ? 'bg-success-500' :
            variant === 'warning' ? 'bg-warning-500' :
            variant === 'error' ? 'bg-error-500' : 'bg-primary-500'
          }`}
          style={{
            top: size / 2 - radius * Math.cos((percentage / 100) * 2 * Math.PI) - 6,
            left: size / 2 + radius * Math.sin((percentage / 100) * 2 * Math.PI) - 6
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.8, 1, 0.8]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      )}
    </div>
  );
};

export default ProgressBar;