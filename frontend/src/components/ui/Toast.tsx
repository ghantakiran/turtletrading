import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ToastProps {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({
  id,
  title,
  message,
  type,
  duration = 5000,
  onClose
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-gradient-to-r from-success-500 to-success-600',
          icon: '✓',
          progress: 'bg-success-300'
        };
      case 'error':
        return {
          bg: 'bg-gradient-to-r from-error-500 to-error-600',
          icon: '✕',
          progress: 'bg-error-300'
        };
      case 'warning':
        return {
          bg: 'bg-gradient-to-r from-warning-500 to-warning-600',
          icon: '⚠',
          progress: 'bg-warning-300'
        };
      case 'info':
        return {
          bg: 'bg-gradient-to-r from-primary-500 to-primary-600',
          icon: 'i',
          progress: 'bg-primary-300'
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-secondary-500 to-secondary-600',
          icon: 'i',
          progress: 'bg-secondary-300'
        };
    }
  };

  const styles = getToastStyles();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`relative overflow-hidden rounded-xl shadow-lg ${styles.bg} text-white max-w-md w-full`}
    >
      {/* Progress bar */}
      <motion.div
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        className={`absolute top-0 left-0 h-1 ${styles.progress}`}
      />

      <div className="p-4">
        <div className="flex items-start">
          {/* Icon */}
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mr-3"
          >
            <span className="text-lg font-bold">{styles.icon}</span>
          </motion.div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-sm font-semibold"
            >
              {title}
            </motion.p>
            {message && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-sm opacity-90 mt-1"
              >
                {message}
              </motion.p>
            )}
          </div>

          {/* Close button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onClose(id)}
            className="flex-shrink-0 ml-3 text-white/80 hover:text-white focus:outline-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Shine effect */}
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatType: 'loop',
          ease: 'linear',
          delay: 1
        }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform skew-x-12"
      />
    </motion.div>
  );
};

// Toast Container
interface ToastContainerProps {
  toasts: ToastProps[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toast;