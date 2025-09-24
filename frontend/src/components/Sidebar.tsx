import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUIStore, useMarketStore, useAuthStore } from '../stores';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  navigation?: Array<{
    name: string;
    href: string;
    icon: string;
    badge?: string;
  }>;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen = true,
  onClose,
  navigation = [
    { name: 'Dashboard', href: '/', icon: '📊' },
    { name: 'Portfolio', href: '/portfolio', icon: '💼' },
    { name: 'Watchlist', href: '/watchlist', icon: '👁️' },
    { name: 'Analytics', href: '/analytics', icon: '📈' },
    { name: 'Alerts', href: '/alerts', icon: '🔔', badge: '3' },
    { name: 'Market', href: '/market', icon: '🌍' },
    { name: 'News & Sentiment', href: '/sentiment', icon: '📰' },
    { name: 'Settings', href: '/settings', icon: '⚙️' },
  ]
}) => {
  const location = useLocation();
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  
  // Zustand stores
  const { isMobile, layout: { sidebarCollapsed } } = useUIStore();
  const { watchlists, selectedWatchlist, marketIndices } = useMarketStore();
  const { isAuthenticated, user } = useAuthStore();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const currentWatchlist = watchlists.find(w => w.id === selectedWatchlist);

  // Don't render on mobile if not open, or if collapsed on desktop
  if (isMobile && !isOpen) return null;
  if (!isMobile && sidebarCollapsed) return null;

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-background-secondary border-r border-secondary-700
        transform transition-transform duration-300 ease-in-out
        ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
        ${!isMobile ? 'relative' : ''}
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-secondary-700">
            <div className="flex items-center space-x-3">
              <div className="text-xl">🐢</div>
              <div>
                <div className="text-sm font-bold text-secondary-100">
                  TurtleTrading
                </div>
                <div className="text-xs text-secondary-400">
                  AI Analytics
                </div>
              </div>
            </div>
            {isMobile && (
              <button
                onClick={onClose}
                className="p-2 rounded-md text-secondary-300 hover:text-secondary-100 hover:bg-secondary-800"
                aria-label="Close sidebar"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={isMobile ? onClose : undefined}
                className={`
                  group flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive(item.href)
                    ? 'bg-primary-900/50 text-primary-400 border border-primary-700'
                    : 'text-secondary-300 hover:text-secondary-100 hover:bg-secondary-800 border border-transparent'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="chip-success">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Market Summary Section */}
          <div className="px-4 py-3 border-t border-secondary-700">
            <button
              onClick={() => toggleSection('market')}
              className="flex items-center justify-between w-full text-left text-sm font-medium text-secondary-300 hover:text-secondary-100"
            >
              <span>📈 Market Summary</span>
              <svg
                className={`h-4 w-4 transition-transform ${collapsedSections.includes('market') ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {!collapsedSections.includes('market') && (
              <div className="mt-2 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-secondary-400">S&P 500</span>
                  <span className="font-medium text-secondary-100">
                    {marketIndices['SPY']?.value?.toFixed(0) || '4,530'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-secondary-400">NASDAQ</span>
                  <span className="font-medium text-secondary-100">
                    {marketIndices['QQQ']?.value?.toFixed(0) || '15,846'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-secondary-400">VIX</span>
                  <span className="font-medium text-warning-500">23.45</span>
                </div>
              </div>
            )}
          </div>

          {/* Watchlist Section */}
          {currentWatchlist && (
            <div className="px-4 py-3 border-t border-secondary-700">
              <button
                onClick={() => toggleSection('watchlist')}
                className="flex items-center justify-between w-full text-left text-sm font-medium text-secondary-300 hover:text-secondary-100"
              >
                <span>⭐ {currentWatchlist.name}</span>
                <svg
                  className={`h-4 w-4 transition-transform ${collapsedSections.includes('watchlist') ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {!collapsedSections.includes('watchlist') && (
                <div className="mt-2 space-y-1">
                  {currentWatchlist.symbols.slice(0, 5).map((symbol) => (
                    <Link
                      key={symbol}
                      to={`/stock/${symbol}`}
                      onClick={isMobile ? onClose : undefined}
                      className="flex justify-between items-center py-1 px-2 text-xs text-secondary-400 hover:text-secondary-100 hover:bg-secondary-800 rounded"
                    >
                      <span className="font-medium">{symbol}</span>
                      <span className="text-success-500">+1.2%</span>
                    </Link>
                  ))}
                  {currentWatchlist.symbols.length > 5 && (
                    <div className="text-xs text-secondary-400 px-2 py-1">
                      +{currentWatchlist.symbols.length - 5} more
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* User Section */}
          {isAuthenticated && user && (
            <div className="px-4 py-3 border-t border-secondary-700">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-secondary-100 truncate">
                    {user.email}
                  </div>
                  <div className="text-xs text-secondary-400">
                    Pro Account
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;