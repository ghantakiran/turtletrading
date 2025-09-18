import React from 'react';

const TestPage: React.FC = () => {
  return (
    <div className="space-y-6 p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Tailwind CSS Design System Test
      </h1>
      
      {/* Test Primary Colors */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Primary Colors</h2>
        <div className="flex space-x-4">
          <div className="w-16 h-16 bg-primary-500 rounded"></div>
          <div className="w-16 h-16 bg-primary-600 rounded"></div>
          <div className="w-16 h-16 bg-primary-700 rounded"></div>
        </div>
      </div>

      {/* Test Trading Colors */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Trading Colors</h2>
        <div className="flex space-x-4">
          <div className="w-16 h-16 bg-bull-500 rounded"></div>
          <div className="w-16 h-16 bg-bear-500 rounded"></div>
        </div>
      </div>

      {/* Test Button Components */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Button Components</h2>
        <div className="flex space-x-4">
          <button className="btn btn-primary">Primary Button</button>
          <button className="btn btn-secondary">Secondary Button</button>
          <button className="btn btn-bull">Bull Button</button>
          <button className="btn btn-bear">Bear Button</button>
        </div>
      </div>

      {/* Test Card Component */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Card Components</h2>
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-medium mb-2">Test Card</h3>
            <p className="text-gray-600 dark:text-gray-400">
              This is a test card to verify the design system is working.
            </p>
          </div>
        </div>
      </div>

      {/* Test Status Indicators */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Status Indicators</h2>
        <div className="flex space-x-4 items-center">
          <span className="status-indicator status-online"></span>
          <span>Online</span>
          <span className="status-indicator status-offline"></span>
          <span>Offline</span>
          <span className="status-indicator status-warning"></span>
          <span>Warning</span>
        </div>
      </div>
    </div>
  );
};

export default TestPage;