import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardGrid from '../components/DashboardGrid';
import { useMarketStore } from '../stores';
import AnimatedBackground from '../components/ui/AnimatedBackground';
import GlassCard from '../components/ui/GlassCard';
import ModernLoader from '../components/ui/ModernLoader';

const Dashboard: React.FC = () => {
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isConnected } = useMarketStore();

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <ModernLoader variant="market" text="Loading Trading Dashboard..." fullScreen />;
  }

  return (
    <div data-testid="dashboard" className="relative min-h-screen">
      {/* Animated Background */}
      <AnimatedBackground variant="gradient" />

      {/* Dashboard Content */}
      <motion.div
        className="relative z-10 space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* Enhanced Dashboard Header */}
        <GlassCard className="p-8 mb-8">
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

      {/* Floating Action Button */}
      <AnimatePresence>
        <motion.button
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full shadow-lg shadow-primary-500/25 flex items-center justify-center text-white hover:shadow-xl hover:shadow-primary-500/40 z-50"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          onClick={() => setEditMode(!editMode)}
          title={editMode ? "Exit Edit Mode" : "Enter Edit Mode"}
        >
          <motion.svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={{ rotate: editMode ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {editMode ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            )}
          </motion.svg>
        </motion.button>
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;