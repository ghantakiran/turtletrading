import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface AnimatedBackgroundProps {
  variant?: 'gradient' | 'particles' | 'waves' | 'grid' | 'trading' | 'neural';
  className?: string;
  interactive?: boolean;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  variant = 'gradient',
  className = '',
  interactive = true
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (interactive) {
      const handleMouseMove = (e: MouseEvent) => {
        setMousePosition({
          x: (e.clientX / window.innerWidth) * 100,
          y: (e.clientY / window.innerHeight) * 100,
        });
      };

      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, [interactive]);

  // Advanced particle system for neural variant
  useEffect(() => {
    if (variant === 'neural' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      const neurons: Array<{
        x: number;
        y: number;
        vx: number;
        vy: number;
        size: number;
        connections: number[];
        activity: number;
      }> = [];

      // Create neurons
      for (let i = 0; i < 80; i++) {
        neurons.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 4 + 2,
          connections: [],
          activity: Math.random()
        });
      }

      // Create connections
      neurons.forEach((neuron, i) => {
        const connections = Math.floor(Math.random() * 4) + 2;
        for (let j = 0; j < connections; j++) {
          const target = Math.floor(Math.random() * neurons.length);
          if (target !== i && !neuron.connections.includes(target)) {
            neuron.connections.push(target);
          }
        }
      });

      let animationId: number;

      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        neurons.forEach((neuron, i) => {
          // Update position
          neuron.x += neuron.vx;
          neuron.y += neuron.vy;

          // Bounce off edges
          if (neuron.x < 0 || neuron.x > canvas.width) neuron.vx *= -1;
          if (neuron.y < 0 || neuron.y > canvas.height) neuron.vy *= -1;

          // Update activity
          neuron.activity = (neuron.activity + Math.random() * 0.02 - 0.01) % 1;

          // Draw connections
          neuron.connections.forEach(targetIndex => {
            const target = neurons[targetIndex];
            if (target) {
              const activity = Math.sin(Date.now() * 0.002 + i) * 0.5 + 0.5;
              ctx.beginPath();
              ctx.moveTo(neuron.x, neuron.y);
              ctx.lineTo(target.x, target.y);
              ctx.strokeStyle = `rgba(14, 165, 233, ${activity * 0.3})`;
              ctx.lineWidth = activity * 2;
              ctx.stroke();
            }
          });

          // Draw neuron
          const glow = Math.sin(Date.now() * 0.003 + i) * 0.3 + 0.7;
          ctx.beginPath();
          ctx.arc(neuron.x, neuron.y, neuron.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34, 197, 94, ${glow})`;
          ctx.fill();

          // Add glow effect
          ctx.beginPath();
          ctx.arc(neuron.x, neuron.y, neuron.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34, 197, 94, ${glow * 0.2})`;
          ctx.fill();
        });

        animationId = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        window.removeEventListener('resize', resizeCanvas);
        cancelAnimationFrame(animationId);
      };
    }
  }, [variant]);

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

  if (variant === 'neural') {
    return (
      <div className={`fixed inset-0 -z-10 pointer-events-none ${className}`}>
        <canvas ref={canvasRef} className="w-full h-full opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-br from-secondary-900/80 via-transparent to-secondary-900/80" />
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className={`fixed inset-0 -z-10 pointer-events-none overflow-hidden ${className}`}>
        <motion.div
          className="w-full h-full opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(14, 165, 233, 0.4) 1px, transparent 1px),
              linear-gradient(90deg, rgba(14, 165, 233, 0.4) 1px, transparent 1px),
              linear-gradient(rgba(34, 197, 94, 0.2) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34, 197, 94, 0.2) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px, 50px 50px, 10px 10px, 10px 10px',
          }}
          animate={{
            backgroundPosition: ['0 0, 0 0, 0 0, 0 0', '50px 50px, 50px 50px, 10px 10px, 10px 10px'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-secondary-900/60 via-transparent to-secondary-900/60" />
      </div>
    );
  }

  if (variant === 'trading') {
    return (
      <div className={`fixed inset-0 -z-10 pointer-events-none overflow-hidden ${className}`}>
        {/* Animated stock tickers */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-xs font-mono opacity-10 text-primary-400"
            style={{
              left: `${5 + i * 8}%`,
              color: i % 3 === 0 ? '#22c55e' : i % 3 === 1 ? '#ef4444' : '#f59e0b',
            }}
            animate={{
              y: ['-10vh', '110vh'],
            }}
            transition={{
              duration: 15 + Math.random() * 10,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 1.5,
            }}
          >
            {[
              'AAPL 234.56 ↑ +2.34%',
              'MSFT 412.34 ↓ -1.23%',
              'GOOGL 145.67 ↑ +0.89%',
              'AMZN 156.78 ↓ -0.45%',
              'TSLA 234.89 ↑ +3.21%',
              'NVDA 456.12 ↓ -2.11%',
              'META 345.67 ↑ +1.45%',
              'NFLX 234.45 ↓ -0.67%',
              'BTC 65432.10 ↑ +4.32%',
              'ETH 3456.78 ↓ -1.89%',
              'SPY 453.21 ↑ +0.34%',
              'QQQ 367.89 ↓ -0.12%'
            ][i] || `STOCK ${Math.floor(Math.random() * 999)} ${Math.random() > 0.5 ? '↑' : '↓'}`}
          </motion.div>
        ))}

        {/* Animated chart lines */}
        <svg className="absolute inset-0 w-full h-full opacity-5">
          <defs>
            <linearGradient id="bull-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(34, 197, 94, 0.3)" />
              <stop offset="100%" stopColor="rgba(34, 197, 94, 0.1)" />
            </linearGradient>
            <linearGradient id="bear-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.3)" />
              <stop offset="100%" stopColor="rgba(239, 68, 68, 0.1)" />
            </linearGradient>
          </defs>
          {[...Array(5)].map((_, i) => (
            <motion.path
              key={i}
              d={`M0,${200 + i * 100} Q${window.innerWidth * 0.25},${150 + i * 80} ${window.innerWidth * 0.5},${200 + i * 90} T${window.innerWidth},${180 + i * 85}`}
              stroke={i % 2 === 0 ? 'url(#bull-gradient)' : 'url(#bear-gradient)'}
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{
                duration: 3 + i,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.5,
              }}
            />
          ))}
        </svg>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-secondary-900/70 via-transparent to-secondary-900/70" />
      </div>
    );
  }

  return null;
};

export default AnimatedBackground;