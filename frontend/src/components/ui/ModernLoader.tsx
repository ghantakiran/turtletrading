import React from 'react';
import { motion } from 'framer-motion';

interface ModernLoaderProps {
  variant?: 'spinner' | 'dots' | 'bars' | 'pulse' | 'market';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'bull' | 'bear';
  fullScreen?: boolean;
}

const ModernLoader: React.FC<ModernLoaderProps> = ({
  variant = 'market',
  size = 'md',
  text = 'Loading...',
  color = 'primary',
  fullScreen = false
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const colorClasses = {
    primary: 'text-primary-500',
    secondary: 'text-secondary-400',
    success: 'text-success-500',
    warning: 'text-warning-500',
    bull: 'text-bull-500',
    bear: 'text-bear-500'
  };

  const LoaderContent = () => {
    switch (variant) {
      case 'spinner':
        return (
          <motion.div
            className={`${sizeClasses[size]} border-2 border-t-transparent rounded-full ${colorClasses[color]} border-current`}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        );

      case 'dots':
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className={`w-2 h-2 bg-current rounded-full ${colorClasses[color]}`}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </div>
        );

      case 'bars':
        return (
          <div className="flex items-end space-x-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className={`w-1 bg-current ${colorClasses[color]} rounded-t`}
                animate={{
                  height: [8, 24, 8]
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.1
                }}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <motion.div
            className={`${sizeClasses[size]} rounded-full bg-current ${colorClasses[color]}`}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity
            }}
          />
        );

      case 'market':
        return (
          <div className="relative">
            {/* Chart-like animation */}
            <div className="flex items-end space-x-1 mb-2">
              {[12, 20, 8, 16, 24, 14, 18].map((height, i) => (
                <motion.div
                  key={i}
                  className={`w-2 bg-gradient-to-t from-bull-500 to-bull-400 rounded-t`}
                  initial={{ height: 4 }}
                  animate={{ height }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    delay: i * 0.15
                  }}
                />
              ))}
            </div>

            {/* Pulsing dot */}
            <motion.div
              className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-bull-500 rounded-full"
              animate={{
                opacity: [0, 1, 0],
                scale: [0.8, 1.2, 0.8]
              }}
              transition={{
                duration: 1,
                repeat: Infinity
              }}
            />
          </div>
        );

      default:
        return <div className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-current border-t-transparent`} />;
    }
  };

  const content = (
    <div className="flex flex-col items-center justify-center space-y-4">
      <LoaderContent />
      {text && (
        <motion.p
          className={`text-sm font-medium ${colorClasses[color]}`}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <motion.div
        className="fixed inset-0 bg-secondary-900/95 backdrop-blur-sm z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {content}
      </motion.div>
    );
  }

  return content;
};

export default ModernLoader;