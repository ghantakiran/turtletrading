import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useUIStore } from '../stores';
import Header from './Header';
import Sidebar from './Sidebar';
import Breadcrumb from './Breadcrumb';
import Footer from './Footer';
import { ErrorBoundaryWithStore } from './ErrorBoundary';
import AsyncErrorBoundary from './AsyncErrorBoundary';

const Layout: React.FC = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Zustand stores
  const { 
    setCurrentPage, 
    setScreenSize, 
    isMobile, 
    layout: { sidebarCollapsed },
    toggleSidebar 
  } = useUIStore();

  // Update current page when location changes
  useEffect(() => {
    setCurrentPage(location.pathname);
  }, [location.pathname, setCurrentPage]);

  // Set up responsive design listener
  useEffect(() => {
    const updateScreenSize = () => {
      setScreenSize(window.innerWidth, window.innerHeight);
    };
    
    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    
    return () => window.removeEventListener('resize', updateScreenSize);
  }, [setScreenSize]);

  // Close mobile sidebar when location changes
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header Component */}
      <ErrorBoundaryWithStore level="component">
        <Header
          navigation={[
            { name: 'Dashboard', href: '/', icon: '📊' },
            { name: 'Market', href: '/market', icon: '📈' },
            { name: 'Yahoo Demo', href: '/yahoo-demo', icon: '🎨' },
            { name: 'Profile', href: '/profile', icon: '👤' },
            { name: 'Settings', href: '/settings', icon: '⚙️' },
            { name: 'About', href: '/about', icon: 'ℹ️' },
          ]}
          onSidebarToggle={() => setIsSidebarOpen(true)}
          showSidebarToggle={isMobile}
        />
      </ErrorBoundaryWithStore>

      {/* Breadcrumb Navigation */}
      <ErrorBoundaryWithStore level="component">
        <Breadcrumb />
      </ErrorBoundaryWithStore>

      {/* Main Layout with Sidebar */}
      <div className="flex">
        {/* Sidebar Component */}
        <ErrorBoundaryWithStore level="component">
          <AsyncErrorBoundary isolate>
            <Sidebar
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
            />
          </AsyncErrorBoundary>
        </ErrorBoundaryWithStore>

        {/* Main Content Area */}
        <main className={`
          flex-1 px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300
          ${!isMobile && !sidebarCollapsed ? 'ml-72' : ''}
        `}>
          <Outlet />
        </main>
      </div>

      {/* Footer Component */}
      <ErrorBoundaryWithStore level="component">
        <Footer />
      </ErrorBoundaryWithStore>
      
      {/* Mobile Sidebar Toggle Button */}
      {isMobile && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed bottom-6 right-6 z-30 p-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors md:hidden"
          aria-label="Open sidebar"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default Layout;