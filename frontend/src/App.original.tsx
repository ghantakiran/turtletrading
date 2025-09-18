import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ErrorFallback from './components/ui/ErrorFallback';

// Lazy load pages for better performance
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const StockAnalysis = React.lazy(() => import('./pages/StockAnalysis'));
const MarketOverview = React.lazy(() => import('./pages/MarketOverview'));
const SentimentCenter = React.lazy(() => import('./pages/SentimentCenter'));
const Portfolio = React.lazy(() => import('./pages/Portfolio'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Login = React.lazy(() => import('./pages/auth/Login'));
const Register = React.lazy(() => import('./pages/auth/Register'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

// Protected Route wrapper
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuth } from './hooks/useAuth';

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="App min-h-screen bg-gray-50 dark:bg-gray-900">
        <Suspense fallback={<LoadingSpinner size="lg" centered />}>
          <Routes>
            {/* Public routes */}
            <Route 
              path="/login" 
              element={
                isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
              } 
            />
            <Route 
              path="/register" 
              element={
                isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />
              } 
            />
            
            {/* Protected routes */}
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/stocks/:symbol?" 
                element={
                  <ProtectedRoute>
                    <StockAnalysis />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/market" 
                element={
                  <ProtectedRoute>
                    <MarketOverview />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/sentiment" 
                element={
                  <ProtectedRoute>
                    <SentimentCenter />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/portfolio" 
                element={
                  <ProtectedRoute>
                    <Portfolio />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } 
              />
            </Route>
            
            {/* Catch all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

export default App;