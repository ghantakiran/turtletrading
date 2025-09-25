import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardGrid from '../components/DashboardGrid';
import { useMarketStore } from '../stores';
import AnimatedBackground from '../components/ui/AnimatedBackground';
import GlassCard from '../components/ui/GlassCard';
import ModernLoader from '../components/ui/ModernLoader';
import SkeletonLoader from '../components/ui/SkeletonLoader';
import Button from '../components/ui/Button';
import ProgressBar, { CircularProgress } from '../components/ui/ProgressBar';

const Dashboard: React.FC = () => {
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const { isConnected } = useMarketStore();

  // Enhanced loading with progress simulation
  useEffect(() => {
    const loadingSteps = [
      { delay: 200, progress: 25, text: 'Connecting to markets...' },
      { delay: 500, progress: 50, text: 'Loading portfolio data...' },
      { delay: 800, progress: 75, text: 'Fetching real-time prices...' },
      { delay: 1200, progress: 100, text: 'Dashboard ready!' }
    ];

    loadingSteps.forEach((step, index) => {
      setTimeout(() => {
        setProgress(step.progress);
        if (index === loadingSteps.length - 1) {
          setTimeout(() => {
            setIsLoading(false);
            setContentLoaded(true);
          }, 300);
        }
      }, step.delay);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900 z-50 flex flex-col items-center justify-center">
        <AnimatedBackground variant="neural" />
        <div className="relative z-10 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-xl shadow-primary-500/25">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white">TurtleTrading</h1>
            <p className="text-secondary-300">AI-Powered Trading Platform</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="w-80 mx-auto space-y-4"
          >
            <ProgressBar
              value={progress}
              variant="gradient"
              animated
              striped
              className="mb-4"
            />
            <ModernLoader variant="neural" size="lg" text="Initializing AI Trading Systems..." glow />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard" className="relative min-h-screen">
      {/* Animated Background */}
      <AnimatedBackground variant="trading" />

      {/* Dashboard Content */}
      <motion.div
        className="relative z-10 space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* Enhanced Dashboard Header */}
        <GlassCard variant="trading" glow interactive className="p-8 mb-8">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center space-x-4 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/25">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-secondary-200 bg-clip-text text-transparent">
                    Trading Dashboard
                  </h1>
                  <div className="flex items-center space-x-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500 animate-pulse' : 'bg-error-500'}`} />
                    <p className="text-secondary-400 text-lg">
                      {isConnected ? 'Live market data • Real-time insights' : 'Market data offline'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="flex items-center space-x-6"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {/* Enhanced Portfolio Balance Display */}
              <div className="text-right">
                <motion.div
                  className="text-3xl font-bold text-transparent bg-gradient-to-r from-success-400 to-success-500 bg-clip-text"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  $142,750.85
                </motion.div>
                <motion.div
                  className="flex items-center justify-end text-success-400 text-base mt-1"
                  whileHover={{ scale: 1.05 }}
                >
                  <motion.svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    animate={{ y: [-2, 0, -2] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 14l9-9 9 9" />
                  </motion.svg>
                  <span className="font-semibold">+$3,450.12 (2.48%)</span>
                </motion.div>
                <div className="text-sm text-secondary-500 mt-1">
                  Today's P&L
                </div>
              </div>

              {/* Performance Indicators */}
              <div className="flex space-x-4">
                <motion.div
                  className="text-center px-4 py-3 bg-white/5 rounded-xl border border-white/10"
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                >
                  <div className="text-lg font-bold text-bull-400">87.5%</div>
                  <div className="text-xs text-secondary-400">Win Rate</div>
                </motion.div>
                <motion.div
                  className="text-center px-4 py-3 bg-white/5 rounded-xl border border-white/10"
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                >
                  <div className="text-lg font-bold text-primary-400">2.4</div>
                  <div className="text-xs text-secondary-400">Sharpe</div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </GlassCard>

        {/* Enhanced Dashboard Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <DashboardGrid editMode={editMode} onEditModeChange={setEditMode} />
        </motion.div>
      </motion.div>

      {/* Enhanced Floating Action Button */}
      <AnimatePresence>
        <motion.div
          className="fixed bottom-6 right-6 z-50"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <Button
            variant="gradient"
            size="lg"
            glow
            onClick={() => setEditMode(!editMode)}
            className="w-16 h-16 rounded-full !p-0 shadow-2xl"
            title={editMode ? "Exit Edit Mode" : "Enter Edit Mode"}
          >
            <motion.svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              animate={{ rotate: editMode ? 45 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {editMode ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              )}
            </motion.svg>
          </Button>

          {/* Quick Action Menu */}
          <AnimatePresence>
            {editMode && (
              <motion.div
                initial={{ opacity: 0, scale: 0, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0, y: 20 }}
                className="absolute bottom-20 right-0 space-y-3"
              >
                <Button
                  variant="primary"
                  size="sm"
                  className="w-12 h-12 rounded-full !p-0"
                  title="Add Widget"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-12 h-12 rounded-full !p-0"
                  title="Customize Layout"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  className="w-12 h-12 rounded-full !p-0"
                  title="Save Layout"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;