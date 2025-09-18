import React from 'react';
import { useMarketStore } from '../stores';

interface FooterProps {
  links?: Array<{
    href: string;
    label: string;
    external?: boolean;
  }>;
  showSystemStatus?: boolean;
}

const Footer: React.FC<FooterProps> = ({ 
  links = [
    { href: '/api/v1/docs', label: 'API Docs', external: true },
    { href: 'mailto:support@turtletrading.ai', label: 'Support', external: true },
  ],
  showSystemStatus = true 
}) => {
  const { isConnected } = useMarketStore();

  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Copyright and Branding */}
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
            <span>&copy; 2025 TurtleTrading</span>
            <span>•</span>
            <span>AI-Powered Trading Platform</span>
          </div>
          
          {/* Links and System Status */}
          <div className="flex items-center space-x-6 text-sm">
            {/* Footer Links */}
            {links.map((link, index) => (
              <a
                key={index}
                href={link.href}
                {...(link.external ? {
                  target: '_blank',
                  rel: 'noopener noreferrer'
                } : {})}
                className="text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
            
            {/* System Status */}
            {showSystemStatus && (
              <div className="flex items-center space-x-2">
                <span 
                  className={`status-indicator ${isConnected ? 'status-online' : 'status-offline'}`}
                  aria-label={isConnected ? 'Systems operational' : 'Connection issues'}
                ></span>
                <span className="text-gray-600 dark:text-gray-400">
                  {isConnected ? 'All Systems Operational' : 'Connection Issues'}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Additional Footer Information */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>Built with React & FastAPI</span>
              <span>•</span>
              <span>Powered by AI</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <a 
                href="/privacy" 
                className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Privacy Policy
              </a>
              <span>•</span>
              <a 
                href="/terms" 
                className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Terms of Service
              </a>
              <span>•</span>
              <a 
                href="/status" 
                className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                System Status
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;