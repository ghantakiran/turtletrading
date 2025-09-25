import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  blur?: 'sm' | 'md' | 'lg' | 'xl';
  gradient?: boolean;
  border?: boolean;
  glow?: boolean;
  interactive?: boolean;
  variant?: 'default' | 'trading' | 'premium' | 'minimal';
  animate?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hover = true,
  blur = 'md',
  gradient = true,
  border = true,
  glow = false,
  interactive = false,
  variant = 'default',
  animate = true
}) => {
  const blurClasses = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
    xl: 'backdrop-blur-xl'
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'trading':
        return `
          ${blurClasses[blur]}
          bg-gradient-to-br from-bull-500/10 via-primary-500/5 to-bear-500/10
          ${border ? 'border border-primary-500/20' : ''}
          rounded-xl shadow-2xl shadow-primary-500/10
          ${glow ? 'shadow-primary-500/25' : ''}
        `;
      case 'premium':
        return `
          ${blurClasses[blur]}
          bg-gradient-to-br from-yellow-500/15 via-orange-500/10 to-red-500/15
          ${border ? 'border border-yellow-500/30' : ''}
          rounded-2xl shadow-2xl shadow-yellow-500/20
          ${glow ? 'shadow-yellow-500/40' : ''}
        `;
      case 'minimal':
        return `
          ${blurClasses[blur]}
          bg-white/5
          ${border ? 'border border-white/10' : ''}
          rounded-lg shadow-lg shadow-black/5
        `;
      default:
        return `
          ${blurClasses[blur]}
          bg-white/10 dark:bg-white/5
          ${gradient ? 'bg-gradient-to-br from-white/20 via-white/10 to-transparent dark:from-white/10 dark:via-white/5 dark:to-transparent' : ''}
          ${border ? 'border border-white/20 dark:border-white/10' : ''}
          rounded-xl shadow-lg shadow-black/5 dark:shadow-black/20
          ${glow ? 'shadow-primary-500/20' : ''}
        `;
    }
  };

  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.95,
      rotateX: 10
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotateX: 0,
      transition: {
        duration: 0.6,
        ease: [0.4, 0.0, 0.2, 1]
      }
    },
    hover: {
      y: hover ? -8 : 0,
      scale: hover ? 1.02 : 1,
      rotateY: hover ? 2 : 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    },
    tap: {
      scale: interactive ? 0.98 : 1,
      transition: { duration: 0.1 }
    }
  };

  const glowVariants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: {
      opacity: glow ? 0.6 : 0,
      scale: 1,
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: 'reverse' as const
      }
    },
    hover: {
      opacity: glow ? 0.9 : 0,
      scale: 1.05,
      transition: { duration: 0.3 }
    }
  };

  return (
    <motion.div
      className={`relative ${interactive ? 'cursor-pointer' : ''}`}
      variants={animate ? cardVariants : undefined}
      initial={animate ? "hidden" : undefined}
      animate={animate ? "visible" : undefined}
      whileHover={hover || interactive ? "hover" : undefined}
      whileTap={interactive ? "tap" : undefined}
      style={{ perspective: '1000px' }}
    >
      {/* Glow effect */}
      {glow && (
        <motion.div
          className="absolute -inset-2 rounded-2xl blur-xl"
          style={{
            background: variant === 'trading'
              ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.3), rgba(34, 197, 94, 0.3))'
              : variant === 'premium'
              ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.4), rgba(239, 68, 68, 0.4))'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(147, 51, 234, 0.3))'
          }}
          variants={glowVariants}
          initial="initial"
          animate="animate"
          whileHover="hover"
        />
      )}

      {/* Main card */}
      <motion.div
        className={`
          relative overflow-hidden
          ${getVariantStyles()}
          transition-all duration-300 ease-out
          ${className}
        `}
        style={{
          transformStyle: 'preserve-3d'
        }}
      >
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 opacity-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
          }}
          whileHover={{
            opacity: 1,
            x: ['-100%', '100%'],
            transition: {
              duration: 0.8,
              ease: 'easeInOut'
            }
          }}
        />

        {/* Floating particles for trading variant */}
        {variant === 'trading' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-primary-400/40 rounded-full"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  top: `${20 + Math.random() * 60}%`,
                }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0.2, 0.8, 0.2],
                  scale: [0.5, 1.2, 0.5]
                }}
                transition={{
                  duration: 4 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                  ease: 'easeInOut'
                }}
              />
            ))}
          </div>
        )}

        {/* Border animation */}
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: `conic-gradient(from 0deg, transparent, ${
              variant === 'trading' ? 'rgba(14, 165, 233, 0.2)' :
              variant === 'premium' ? 'rgba(251, 191, 36, 0.3)' :
              'rgba(255, 255, 255, 0.2)'
            }, transparent)`,
            mask: 'linear-gradient(white, white) content-box, linear-gradient(white, white)',
            maskComposite: 'xor',
            padding: '1px',
          }}
          animate={{
            rotate: [0, 360]
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'linear'
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default GlassCard;