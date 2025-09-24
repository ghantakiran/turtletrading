import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore, useMarketStore } from '../stores';

interface HeaderProps {
  navigation?: Array<{
    name: string;
    href: string;
    icon: string;
  }>;
  onSidebarToggle?: () => void;
  showSidebarToggle?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  navigation = [
    { name: 'Dashboard', href: '/', icon: '📊' },
    { name: 'Market', href: '/market', icon: '📈' },
    { name: 'Backtesting', href: '/backtesting', icon: '🎯' },
    { name: 'Settings', href: '/settings', icon: '⚙️' },
    { name: 'About', href: '/about', icon: 'ℹ️' },
  ],
  onSidebarToggle,
  showSidebarToggle = true
}) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Zustand stores
  const { isAuthenticated, user } = useAuthStore();
  const { isConnected } = useMarketStore();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="bg-background-secondary shadow-sm border-b border-secondary-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="text-2xl">🐢</div>
            <div>
              <div className="text-xl font-bold text-secondary-100">
                TurtleTrading
              </div>
              <div className="text-xs text-secondary-400">
                AI-Powered Analytics
              </div>
            </div>
          </Link>

          {/* Search Bar (PRD requirement) */}
          <div className="flex-1 max-w-lg mx-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Search stocks, sectors, or news..."
                className="w-full px-4 py-2 pl-10 pr-4 text-sm bg-background-tertiary border border-secondary-600 rounded-lg text-secondary-100 placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Market Status (PRD requirement) */}
            <div className="hidden md:flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500 animate-pulse' : 'bg-error-500'}`}></div>
              <span className={`text-sm ${isConnected ? 'text-success-400' : 'text-error-400'}`}>
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>

            {/* Quick Actions (PRD requirement) */}
            <div className="hidden md:flex items-center space-x-2">
              <button
                className="p-2 rounded-md text-secondary-300 hover:text-secondary-100 hover:bg-secondary-800 transition-colors"
                aria-label="Quick watchlist"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>

            {/* Notifications (PRD requirement) */}
            <button
              className="relative p-2 rounded-md text-secondary-300 hover:text-secondary-100 hover:bg-secondary-800 transition-colors"
              aria-label="Notifications"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-error-500 rounded-full"></span>
            </button>

            {/* User Profile */}
            {isAuthenticated && user && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
            )}

            {/* Desktop Sidebar Toggle */}
            {showSidebarToggle && onSidebarToggle && (
              <button
                onClick={onSidebarToggle}
                className="hidden lg:flex p-2 rounded-md text-secondary-300 hover:text-secondary-100 hover:bg-secondary-800 transition-colors"
                aria-label="Toggle sidebar"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Mobile menu button */}
            <button
              data-testid="mobile-menu-trigger"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-secondary-300 hover:text-secondary-100 hover:bg-secondary-800"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div data-testid="mobile-menu" className="md:hidden border-t border-secondary-700 py-3">
            {/* Mobile Search */}
            <div className="px-3 mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full px-4 py-2 pl-10 pr-4 text-sm bg-background-tertiary border border-secondary-600 rounded-lg text-secondary-100 placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <nav className="space-y-1">
              {/* Quick Actions for Mobile */}
              <div className="px-3 py-2 flex items-center justify-between border-b border-secondary-700 mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500 animate-pulse' : 'bg-error-500'}`}></div>
                  <span className={`text-sm ${isConnected ? 'text-success-400' : 'text-error-400'}`}>
                    {isConnected ? 'Live Market' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 rounded-md text-secondary-300 hover:text-secondary-100 hover:bg-secondary-800">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Mobile User Info */}
              {isAuthenticated && user && (
                <div className="px-3 py-2 border-b border-secondary-700 mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user.email?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-secondary-100">
                        {user.email}
                      </div>
                      <div className="text-xs text-secondary-400">
                        Pro Account
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;