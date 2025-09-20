import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import StockAnalysis from './pages/StockAnalysis';
import MarketOverview from './pages/MarketOverview';
import Settings from './pages/Settings';
import About from './pages/About';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import YahooDemo from './pages/YahooDemo';
import TestPage from './pages/TestPage';
import ErrorTestPage from './pages/ErrorTestPage';
import Backtesting from './pages/Backtesting';
import { ErrorBoundaryWithStore } from './components/ErrorBoundary';
import { RouteErrorFallback } from './components/RouteErrorBoundary';
import AsyncErrorBoundary from './components/AsyncErrorBoundary';
import './App.css';

function App() {
  return (
    <ErrorBoundaryWithStore level="global">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AsyncErrorBoundary maxRetries={3} retryDelay={1000}>
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route
                  path="/login"
                  element={
                    <AsyncErrorBoundary isolate>
                      <Login />
                    </AsyncErrorBoundary>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <AsyncErrorBoundary isolate>
                      <Register />
                    </AsyncErrorBoundary>
                  }
                />

                {/* Protected Routes with Layout */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <ErrorBoundaryWithStore level="page">
                        <Layout />
                      </ErrorBoundaryWithStore>
                    </ProtectedRoute>
                  }
                  errorElement={<RouteErrorFallback />}
                >
                  <Route
                    index
                    element={
                      <AsyncErrorBoundary isolate>
                        <Dashboard />
                      </AsyncErrorBoundary>
                    }
                  />
                  <Route
                    path="dashboard"
                    element={
                      <AsyncErrorBoundary isolate>
                        <Dashboard />
                      </AsyncErrorBoundary>
                    }
                  />
                  <Route
                    path="stock/:symbol"
                    element={
                      <AsyncErrorBoundary isolate>
                        <StockAnalysis />
                      </AsyncErrorBoundary>
                    }
                  />
                  <Route
                    path="market"
                    element={
                      <AsyncErrorBoundary isolate>
                        <MarketOverview />
                      </AsyncErrorBoundary>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <AsyncErrorBoundary isolate>
                        <Settings />
                      </AsyncErrorBoundary>
                    }
                  />
                  <Route
                    path="profile"
                    element={
                      <AsyncErrorBoundary isolate>
                        <Profile />
                      </AsyncErrorBoundary>
                    }
                  />
                  <Route
                    path="about"
                    element={
                      <AsyncErrorBoundary isolate>
                        <About />
                      </AsyncErrorBoundary>
                    }
                  />
                  <Route
                    path="backtesting"
                    element={
                      <AsyncErrorBoundary isolate>
                        <Backtesting />
                      </AsyncErrorBoundary>
                    }
                  />
                  <Route
                    path="yahoo-demo"
                    element={
                      <AsyncErrorBoundary isolate>
                        <YahooDemo />
                      </AsyncErrorBoundary>
                    }
                  />
                  <Route
                    path="test"
                    element={
                      <AsyncErrorBoundary isolate>
                        <TestPage />
                      </AsyncErrorBoundary>
                    }
                  />
                  <Route
                    path="error-test"
                    element={
                      <ErrorTestPage />
                    }
                  />
                  {/* Fallback route for 404 */}
                  <Route path="*" element={<RouteErrorFallback />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AsyncErrorBoundary>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundaryWithStore>
  );
}

export default App;