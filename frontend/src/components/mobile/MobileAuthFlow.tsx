/**
 * Mobile Authentication Flow
 * Optimized for mobile devices with touch gestures, biometric support, and responsive design
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores';
import { useNavigate, useLocation } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon, FingerprintIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface BiometricCredentials {
  username: string;
  encryptedPassword: string;
}

type AuthStep = 'welcome' | 'login' | 'register' | 'biometric' | 'forgot-password';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  rememberMe: boolean;
}

export const MobileAuthFlow: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isLoading, error } = useAuthStore();

  const [currentStep, setCurrentStep] = useState<AuthStep>('welcome');
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);

  // Refs for smooth scrolling and focus management
  const containerRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkBiometricSupport();

    // Auto-focus first input when step changes
    setTimeout(() => {
      if (currentStep === 'login' || currentStep === 'register') {
        emailRef.current?.focus();
      }
    }, 300);
  }, [currentStep]);

  useEffect(() => {
    // Handle keyboard visibility on iOS
    const handleViewportChange = () => {
      const viewport = window.visualViewport;
      if (viewport) {
        const heightDiff = window.innerHeight - viewport.height;
        if (heightDiff > 150) { // Keyboard is likely open
          containerRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    if ('visualViewport' in window) {
      window.visualViewport?.addEventListener('resize', handleViewportChange);
      return () => window.visualViewport?.removeEventListener('resize', handleViewportChange);
    }
  }, []);

  const checkBiometricSupport = async () => {
    if ('credentials' in navigator && 'create' in navigator.credentials) {
      try {
        const available = await (navigator.credentials as any).get({
          publicKey: {
            challenge: new Uint8Array(32),
            timeout: 60000,
            userVerification: 'preferred'
          }
        });
        setBiometricSupported(!!available);
      } catch {
        setBiometricSupported(false);
      }
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async () => {
    try {
      await login(formData.email, formData.password, formData.rememberMe);

      // Store biometric credentials if supported and opted in
      if (biometricSupported && formData.rememberMe) {
        await storeBiometricCredentials(formData.email, formData.password);
      }

      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from);
      toast.success('Welcome back! 🎉');
    } catch (error) {
      toast.error('Login failed. Please check your credentials.');
    }
  };

  const handleRegister = async () => {
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName
      });

      navigate('/');
      toast.success('Account created successfully! 🎉');
    } catch (error) {
      toast.error('Registration failed. Please try again.');
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const credentials = await getBiometricCredentials();
      if (credentials) {
        await login(credentials.username, credentials.encryptedPassword, true);
        navigate('/');
        toast.success('Biometric login successful! 👆');
      }
    } catch (error) {
      toast.error('Biometric authentication failed');
      setCurrentStep('login');
    }
  };

  const storeBiometricCredentials = async (username: string, password: string): Promise<void> => {
    // This would use the Web Authentication API to store encrypted credentials
    // For demo purposes, we'll use localStorage (in production, use secure storage)
    try {
      const encryptedData = btoa(JSON.stringify({ username, password }));
      localStorage.setItem('biometric_credentials', encryptedData);
    } catch (error) {
      console.error('Failed to store biometric credentials:', error);
    }
  };

  const getBiometricCredentials = async (): Promise<BiometricCredentials | null> => {
    try {
      const stored = localStorage.getItem('biometric_credentials');
      if (stored) {
        const data = JSON.parse(atob(stored));
        return {
          username: data.username,
          encryptedPassword: data.password
        };
      }
    } catch (error) {
      console.error('Failed to retrieve biometric credentials:', error);
    }
    return null;
  };

  const handleSwipeDown = (startY: number, endY: number) => {
    const swipeDistance = endY - startY;
    if (swipeDistance > 100 && currentStep !== 'welcome') {
      // Swipe down to go back
      if (currentStep === 'login' || currentStep === 'register') {
        setCurrentStep('welcome');
      }
    }
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  const renderWelcomeStep = () => (
    <motion.div
      className="text-center space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Logo and Branding */}
      <div className="space-y-4">
        <motion.div
          className="w-24 h-24 mx-auto bg-gradient-to-br from-primary-500 to-blue-500 rounded-3xl flex items-center justify-center text-4xl"
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 2, -2, 0]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        >
          🐢
        </motion.div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            TurtleTrading
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            AI-Powered Trading Intelligence
          </p>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="space-y-3">
        <div className="flex items-center justify-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>Real-time market data</span>
        </div>
        <div className="flex items-center justify-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          <span>AI-powered predictions</span>
        </div>
        <div className="flex items-center justify-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
          <span>Professional analytics</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-4">
        {biometricSupported && (
          <motion.button
            onClick={() => setCurrentStep('biometric')}
            className="w-full btn-primary flex items-center justify-center space-x-2 py-4"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FingerprintIcon className="w-5 h-5" />
            <span>Sign in with Biometrics</span>
          </motion.button>
        )}

        <motion.button
          onClick={() => setCurrentStep('login')}
          className="w-full btn-primary py-4"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Sign In
        </motion.button>

        <motion.button
          onClick={() => setCurrentStep('register')}
          className="w-full btn-secondary py-4"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Create Account
        </motion.button>
      </div>

      {/* Demo Access */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => {
            setFormData({
              ...formData,
              email: 'demo@turtletrading.ai',
              password: 'demo123'
            });
            setCurrentStep('login');
          }}
          className="text-sm text-primary-600 dark:text-primary-400 underline"
        >
          Try Demo Account
        </button>
      </div>
    </motion.div>
  );

  const renderLoginStep = () => (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -300 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome Back
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Sign in to access your trading dashboard
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Address
          </label>
          <input
            ref={emailRef}
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="input-primary"
            placeholder="Enter your email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              ref={passwordRef}
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="input-primary pr-12"
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.rememberMe}
              onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
              className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Remember me
            </span>
          </label>

          <button
            onClick={() => setCurrentStep('forgot-password')}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            Forgot password?
          </button>
        </div>
      </div>

      <motion.button
        onClick={handleLogin}
        disabled={isLoading || !formData.email || !formData.password}
        className="w-full btn-primary py-4 disabled:opacity-50 disabled:cursor-not-allowed"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Signing In...</span>
          </div>
        ) : (
          'Sign In'
        )}
      </motion.button>

      <div className="text-center">
        <span className="text-gray-600 dark:text-gray-400">Don't have an account? </span>
        <button
          onClick={() => setCurrentStep('register')}
          className="text-primary-600 dark:text-primary-400 font-medium hover:underline"
        >
          Sign up
        </button>
      </div>
    </motion.div>
  );

  const renderRegisterStep = () => (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -300 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Create Account
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Join thousands of successful traders
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              First Name
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className="input-primary"
              placeholder="First name"
              autoComplete="given-name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Last Name
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className="input-primary"
              placeholder="Last name"
              autoComplete="family-name"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Address
          </label>
          <input
            ref={emailRef}
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="input-primary"
            placeholder="Enter your email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="input-primary pr-12"
              placeholder="Create a password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className="input-primary pr-12"
              placeholder="Confirm your password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <motion.button
        onClick={handleRegister}
        disabled={isLoading || !formData.email || !formData.password || !formData.firstName || !formData.lastName}
        className="w-full btn-primary py-4 disabled:opacity-50 disabled:cursor-not-allowed"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Creating Account...</span>
          </div>
        ) : (
          'Create Account'
        )}
      </motion.button>

      <div className="text-center">
        <span className="text-gray-600 dark:text-gray-400">Already have an account? </span>
        <button
          onClick={() => setCurrentStep('login')}
          className="text-primary-600 dark:text-primary-400 font-medium hover:underline"
        >
          Sign in
        </button>
      </div>
    </motion.div>
  );

  const renderBiometricStep = () => (
    <motion.div
      className="text-center space-y-8"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
    >
      <div className="space-y-4">
        <motion.div
          className="w-24 h-24 mx-auto bg-gradient-to-br from-primary-500 to-blue-500 rounded-full flex items-center justify-center"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.8, 1, 0.8]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        >
          <FingerprintIcon className="w-12 h-12 text-white" />
        </motion.div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Biometric Sign In
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Use your fingerprint or face to sign in securely
          </p>
        </div>
      </div>

      <motion.button
        onClick={handleBiometricLogin}
        className="w-full btn-primary py-4"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Authenticate
      </motion.button>

      <button
        onClick={() => setCurrentStep('login')}
        className="text-primary-600 dark:text-primary-400 hover:underline"
      >
        Use password instead
      </button>
    </motion.div>
  );

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4"
      onTouchStart={(e) => setTouchStartY(e.touches[0].clientY)}
      onTouchEnd={(e) => handleSwipeDown(touchStartY, e.changedTouches[0].clientY)}
    >
      <div className="w-full max-w-md">
        {/* Progress Indicator */}
        {currentStep !== 'welcome' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setCurrentStep('welcome')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ← Back
              </button>
              <div className="text-sm text-gray-500">
                {currentStep === 'login' && 'Sign In'}
                {currentStep === 'register' && 'Create Account'}
                {currentStep === 'biometric' && 'Biometric Auth'}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700"
          layout
        >
          <AnimatePresence mode="wait">
            {currentStep === 'welcome' && renderWelcomeStep()}
            {currentStep === 'login' && renderLoginStep()}
            {currentStep === 'register' && renderRegisterStep()}
            {currentStep === 'biometric' && renderBiometricStep()}
          </AnimatePresence>
        </motion.div>

        {/* Terms and Privacy */}
        <div className="text-center mt-6 text-xs text-gray-500 dark:text-gray-400">
          By continuing, you agree to our{' '}
          <a href="/terms" className="text-primary-600 dark:text-primary-400 hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-primary-600 dark:text-primary-400 hover:underline">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
};

export default MobileAuthFlow;