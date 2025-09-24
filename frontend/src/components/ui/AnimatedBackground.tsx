import React, { useEffect, useState } from 'react';

interface AnimatedBackgroundProps {
  variant?: 'gradient' | 'particles' | 'waves';
  className?: string;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  variant = 'gradient',
  className = ''
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (variant === 'gradient') {
    return (
      <div
        className={`fixed inset-0 -z-10 transition-all duration-1000 ease-out ${className}`}
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%,
            rgba(14, 165, 233, 0.1) 0%,
            rgba(59, 130, 246, 0.05) 25%,
            rgba(147, 51, 234, 0.03) 50%,
            transparent 70%)`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-secondary-500/5 animate-pulse" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.1)_0%,transparent_50%)] animate-slow-pulse" />
      </div>
    );
  }

  if (variant === 'particles') {
    return (
      <div className={`fixed inset-0 -z-10 overflow-hidden ${className}`}>
        {Array.from({ length: 50 }, (_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary-400/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 20}s`,
              animationDuration: `${15 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'waves') {
    return (
      <div className={`fixed inset-0 -z-10 ${className}`}>
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(14, 165, 233, 0.1)" />
              <stop offset="50%" stopColor="rgba(59, 130, 246, 0.05)" />
              <stop offset="100%" stopColor="rgba(147, 51, 234, 0.03)" />
            </linearGradient>
          </defs>
          <path
            d="M0,50 Q25,25 50,50 T100,50 V100 H0 Z"
            fill="url(#wave-gradient)"
            className="animate-wave"
          />
        </svg>
      </div>
    );
  }

  return null;
};

export default AnimatedBackground;