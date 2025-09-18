import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface BreadcrumbProps {
  separator?: string;
  homeLabel?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
  separator = '/', 
  homeLabel = 'Home' 
}) => {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(segment => segment);

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-12 text-sm">
          <Link 
            to="/" 
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
          >
            {homeLabel}
          </Link>
          
          {pathSegments.length > 0 && location.pathname !== '/' && (
            <>
              <span className="mx-2 text-gray-400">{separator}</span>
              
              {pathSegments.map((segment, index) => {
                const isLast = index === pathSegments.length - 1;
                const path = '/' + pathSegments.slice(0, index + 1).join('/');
                const label = segment.charAt(0).toUpperCase() + segment.slice(1);
                
                if (isLast) {
                  return (
                    <span 
                      key={path}
                      className="text-gray-900 dark:text-gray-100 font-medium capitalize"
                    >
                      {label}
                    </span>
                  );
                }
                
                return (
                  <React.Fragment key={path}>
                    <Link
                      to={path}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors capitalize"
                    >
                      {label}
                    </Link>
                    <span className="mx-2 text-gray-400">{separator}</span>
                  </React.Fragment>
                );
              })}
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Breadcrumb;