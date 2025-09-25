import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonLoaderProps {
  variant?: 'text' | 'card' | 'avatar' | 'chart' | 'table';
  className?: string;
  count?: number;
  width?: string;
  height?: string;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'text',
  className = '',
  count = 1,
  width,
  height
}) => {
  const shimmerAnimation = {
    initial: { x: '-100%' },
    animate: { x: '100%' },
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear'
    }
  };

  const SkeletonElement = ({ customClass = '' }: { customClass?: string }) => (
    <div
      className={`relative overflow-hidden bg-gradient-to-r from-secondary-200/30 via-secondary-100/50 to-secondary-200/30 rounded-lg ${customClass}`}
      style={{ width, height }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        {...shimmerAnimation}
      />
    </div>
  );

  const renderSkeleton = () => {
    switch (variant) {
      case 'text':
        return Array.from({ length: count }).map((_, index) => (
          <SkeletonElement
            key={index}
            customClass={`h-4 w-full mb-2 ${index === count - 1 ? 'w-3/4' : ''} ${className}`}
          />
        ));

      case 'card':
        return Array.from({ length: count }).map((_, index) => (
          <div key={index} className={`space-y-4 p-4 ${className}`}>
            <SkeletonElement customClass="h-32 w-full" />
            <div className="space-y-2">
              <SkeletonElement customClass="h-4 w-3/4" />
              <SkeletonElement customClass="h-4 w-1/2" />
            </div>
          </div>
        ));

      case 'avatar':
        return Array.from({ length: count }).map((_, index) => (
          <div key={index} className={`flex items-center space-x-3 ${className}`}>
            <SkeletonElement customClass="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <SkeletonElement customClass="h-4 w-1/4" />
              <SkeletonElement customClass="h-3 w-1/3" />
            </div>
          </div>
        ));

      case 'chart':
        return (
          <div className={`space-y-4 ${className}`}>
            <div className="flex justify-between items-center">
              <SkeletonElement customClass="h-6 w-32" />
              <SkeletonElement customClass="h-8 w-20" />
            </div>
            <div className="relative h-64">
              <div className="flex items-end justify-center space-x-2 h-full">
                {Array.from({ length: 12 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="bg-gradient-to-t from-primary-500/30 to-primary-400/50 rounded-t-sm"
                    style={{
                      width: '20px',
                      height: `${Math.random() * 80 + 20}%`
                    }}
                    animate={{
                      height: [`${Math.random() * 80 + 20}%`, `${Math.random() * 80 + 20}%`]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: 'reverse',
                      delay: i * 0.1
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        );

      case 'table':
        return (
          <div className={`space-y-2 ${className}`}>
            <div className="grid grid-cols-4 gap-4 p-3 bg-secondary-50 rounded-lg">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonElement key={i} customClass="h-4 w-full" />
              ))}
            </div>
            {Array.from({ length: count }).map((_, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-4 gap-4 p-3">
                {Array.from({ length: 4 }).map((_, colIndex) => (
                  <SkeletonElement key={colIndex} customClass="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        );

      default:
        return <SkeletonElement customClass={className} />;
    }
  };

  return <div className="animate-pulse">{renderSkeleton()}</div>;
};

export default SkeletonLoader;