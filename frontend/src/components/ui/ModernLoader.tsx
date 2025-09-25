import React from 'react';
import { motion } from 'framer-motion';

interface ModernLoaderProps {
  variant?: 'spinner' | 'dots' | 'bars' | 'pulse' | 'market' | 'neural' | 'wave' | 'orbit' | 'matrix';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'bull' | 'bear';
  fullScreen?: boolean;
  glow?: boolean;
}

const ModernLoader: React.FC<ModernLoaderProps> = ({
  variant = 'market',
  size = 'md',
  text = 'Loading...',
  color = 'primary',
  fullScreen = false,
  glow = false
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
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

      case 'neural':
        return (
          <div className="relative">
            <div className="flex space-x-2">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-1 h-6 bg-current ${colorClasses[color]} rounded-full ${glow ? 'shadow-lg shadow-current' : ''}`}
                  animate={{
                    scaleY: [0.3, 1, 0.3],
                    opacity: [0.4, 1, 0.4]
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeInOut'
                  }}
                />
              ))}
            </div>
            <motion.div
              className={`absolute -inset-2 bg-gradient-to-r ${
                color === 'bull' ? 'from-bull-500/20 to-bull-600/20' :
                color === 'bear' ? 'from-bear-500/20 to-bear-600/20' :
                'from-primary-500/20 to-primary-600/20'
              } rounded-lg blur-sm`}
              animate={{
                opacity: [0, 0.6, 0],
                scale: [0.8, 1.1, 0.8]
              }}
              transition={{
                duration: 2,
                repeat: Infinity
              }}
            />
          </div>
        );

      case 'wave':
        return (
          <div className="relative">
            <svg className={`${sizeClasses[size]} ${colorClasses[color]}`} viewBox="0 0 100 20">
              <motion.path
                d="M0,10 Q25,0 50,10 T100,10"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              />
              <motion.circle
                cx="0"
                cy="10"
                r="3"
                fill="currentColor"
                initial={{ cx: 0 }}
                animate={{ cx: 100 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              />
            </svg>
            {glow && (
              <motion.div
                className={`absolute inset-0 bg-gradient-to-r ${
                  color === 'bull' ? 'from-bull-500 to-bull-600' :
                  color === 'bear' ? 'from-bear-500 to-bear-600' :
                  'from-primary-500 to-primary-600'
                } rounded-full opacity-30 blur-md`}
                animate={{
                  scale: [1, 1.2, 1]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity
                }}
              />
            )}
          </div>
        );

      case 'orbit':
        return (
          <div className={`relative ${sizeClasses[size]}`}>
            <motion.div
              className={`absolute w-2 h-2 bg-current ${colorClasses[color]} rounded-full`}
              animate={{
                rotate: 360
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: 'linear'
              }}
              style={{
                transformOrigin: '0 16px'
              }}
            />
            <motion.div
              className={`absolute w-1.5 h-1.5 bg-current ${colorClasses[color]} rounded-full opacity-70`}
              animate={{
                rotate: -360
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'linear'
              }}
              style={{
                transformOrigin: '0 12px'
              }}
            />
            <div className={`absolute top-1/2 left-1/2 w-1 h-1 bg-current ${colorClasses[color]} rounded-full transform -translate-x-1/2 -translate-y-1/2`} />
          </div>
        );

      case 'matrix':
        return (
          <div className="relative">
            <div className="grid grid-cols-3 gap-1">
              {[...Array(9)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-2 h-2 bg-current ${colorClasses[color]} rounded`}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0.8, 1, 0.8]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: 'easeInOut'
                  }}
                />
              ))}
            </div>
            {glow && (
              <motion.div
                className={`absolute inset-0 bg-gradient-to-br ${
                  color === 'bull' ? 'from-bull-500/40 to-bull-600/40' :
                  color === 'bear' ? 'from-bear-500/40 to-bear-600/40' :
                  'from-primary-500/40 to-primary-600/40'
                } rounded blur-sm -z-10`}
                animate={{
                  opacity: [0.3, 0.7, 0.3],
                  scale: [1, 1.1, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity
                }}
              />
            )}
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