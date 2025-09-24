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
    <div className="min-h-screen bg-background-primary">
      {/* Dark-first background */}

      {/* Header Component */}
      <ErrorBoundaryWithStore level="component">
        <div className="relative z-20">
          <Header
            onSidebarToggle={() => setIsSidebarOpen(true)}
            showSidebarToggle={isMobile}
          />
        </div>
      </ErrorBoundaryWithStore>

      {/* Breadcrumb Navigation */}
      <ErrorBoundaryWithStore level="component">
        <div className="relative z-20">
          <Breadcrumb />
        </div>
      </ErrorBoundaryWithStore>

      {/* Main Layout with Sidebar */}
      <div className="flex relative z-10">
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
          flex-1 px-6 py-6 transition-all duration-200
          ${!isMobile && !sidebarCollapsed ? 'ml-72' : ''}
        `}>
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Footer Component */}
      <ErrorBoundaryWithStore level="component">
        <div className="relative z-20">
          <Footer />
        </div>
      </ErrorBoundaryWithStore>

      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed bottom-4 right-4 z-50 p-3 bg-primary-500 text-white rounded-lg shadow-lg hover:bg-primary-600 transition-colors md:hidden focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-background-primary"
          aria-label="Open sidebar"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default Layout;