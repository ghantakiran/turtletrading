import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  blur?: 'sm' | 'md' | 'lg';
  gradient?: boolean;
  border?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hover = true,
  blur = 'md',
  gradient = true,
  border = true
}) => {
  const blurClasses = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg'
  };

  const baseClasses = `
    ${blurClasses[blur]}
    bg-white/10 dark:bg-white/5
    ${gradient ? 'bg-gradient-to-br from-white/20 via-white/10 to-transparent dark:from-white/10 dark:via-white/5 dark:to-transparent' : ''}
    ${border ? 'border border-white/20 dark:border-white/10' : ''}
    rounded-xl
    shadow-lg shadow-black/5 dark:shadow-black/20
    transition-all duration-300 ease-out
    ${hover ? 'hover:bg-white/15 dark:hover:bg-white/8 hover:border-white/30 dark:hover:border-white/20 hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/30 hover:-translate-y-1' : ''}
  `;

  if (hover) {
    return (
      <motion.div
        className={`${baseClasses} ${className}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`${baseClasses} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;