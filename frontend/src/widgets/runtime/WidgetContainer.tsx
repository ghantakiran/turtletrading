/**
 * Widget Container Component
 * React component that renders and manages widget runtime instances
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WidgetInstance, WidgetPermission } from '../sdk/WidgetSDK';
import WidgetRuntime, { RuntimeConfig, RuntimeEnvironment } from './WidgetRuntime';
import WidgetSandbox, { SandboxPolicy } from './WidgetSandbox';
import PostMessageBridge, { BridgeConfig } from './PostMessageBridge';

interface WidgetContainerProps {
  widget: WidgetInstance;
  permissions: WidgetPermission[];
  trustLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  onLoad?: (instanceId: string) => void;
  onError?: (instanceId: string, error: any) => void;
  onResize?: (instanceId: string, width: number, height: number) => void;
  onMessage?: (instanceId: string, message: any) => void;
  className?: string;
  style?: React.CSSProperties;
}

interface WidgetContainerState {
  isLoading: boolean;
  isLoaded: boolean;
  hasError: boolean;
  error?: string;
  runtime?: RuntimeEnvironment;
  securityViolations: number;
  resourceUsage: {
    memory: number;
    cpu: number;
    network: number;
  };
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  widget,
  permissions,
  trustLevel = 'MEDIUM',
  onLoad,
  onError,
  onResize,
  onMessage,
  className = '',
  style = {}
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<WidgetRuntime | null>(null);
  const sandboxRef = useRef<WidgetSandbox | null>(null);
  const bridgeRef = useRef<PostMessageBridge | null>(null);

  const [state, setState] = useState<WidgetContainerState>({
    isLoading: false,
    isLoaded: false,
    hasError: false,
    securityViolations: 0,
    resourceUsage: { memory: 0, cpu: 0, network: 0 }
  });

  // Initialize runtime services
  useEffect(() => {
    initializeRuntime();
    return cleanup;
  }, []);

  // Handle widget instance changes
  useEffect(() => {
    if (state.isLoaded && runtimeRef.current) {
      updateWidget();
    }
  }, [widget.id, permissions]);

  /**
   * Initialize the widget runtime environment
   */
  const initializeRuntime = useCallback(async () => {
    if (!containerRef.current) return;

    setState(prev => ({ ...prev, isLoading: true, hasError: false }));

    try {
      // Initialize sandbox
      const sandbox = new WidgetSandbox();
      sandboxRef.current = sandbox;

      // Create security policy
      const sandboxPolicy = sandbox.createSandboxPolicy(permissions, trustLevel);

      // Initialize bridge
      const bridgeConfig: BridgeConfig = {
        allowedOrigins: ['*'], // Configure based on trust level
        messageTimeout: 30000,
        maxQueueSize: 100,
        enableEncryption: trustLevel === 'HIGH',
        rateLimitPerSecond: trustLevel === 'HIGH' ? 100 : trustLevel === 'MEDIUM' ? 50 : 20
      };

      const bridge = new PostMessageBridge(bridgeConfig);
      bridgeRef.current = bridge;

      // Setup bridge message handlers
      setupBridgeHandlers(bridge);

      // Initialize runtime
      const runtimeConfig: RuntimeConfig = {
        sandboxPermissions: sandboxPolicy.allowedFeatures,
        allowedOrigins: bridgeConfig.allowedOrigins,
        cspPolicy: sandbox.generateCSPHeader(sandboxPolicy),
        maxExecutionTime: sandboxPolicy.resourceLimits.maxExecutionTimeMs,
        memoryLimit: sandboxPolicy.resourceLimits.maxMemoryMB,
        communicationTimeout: bridgeConfig.messageTimeout
      };

      const runtime = new WidgetRuntime(runtimeConfig);
      runtimeRef.current = runtime;

      // Setup runtime event handlers
      setupRuntimeHandlers(runtime);

      // Initialize widget
      const environment = await runtime.initializeWidget(
        widget,
        containerRef.current,
        permissions
      );

      // Start sandbox monitoring
      sandbox.startMonitoring(widget.id, sandboxPolicy.id);

      // Register bridge channel
      const iframe = environment.iframe;
      if (iframe.contentWindow) {
        bridge.registerChannel(
          widget.id,
          widget.widgetId,
          iframe.contentWindow,
          window.location.origin
        );
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        isLoaded: true,
        runtime: environment
      }));

      onLoad?.(widget.id);
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        error: error.message
      }));

      onError?.(widget.id, error);
    }
  }, [widget, permissions, trustLevel, onLoad, onError]);

  /**
   * Update widget when props change
   */
  const updateWidget = useCallback(async () => {
    // Implementation for updating widget properties
    // This could involve sending configuration updates to the widget
    if (bridgeRef.current) {
      await bridgeRef.current.sendMessage(widget.id, 'UPDATE_CONFIG', {
        permissions,
        trustLevel,
        timestamp: Date.now()
      });
    }
  }, [widget.id, permissions, trustLevel]);

  /**
   * Setup bridge message handlers
   */
  const setupBridgeHandlers = useCallback((bridge: PostMessageBridge) => {
    // Handle widget data requests
    bridge.onMessage('DATA_REQUEST', async (message, instanceId) => {
      const { dataType, query } = message.payload;

      try {
        // Route data requests to appropriate services
        const data = await handleDataRequest(dataType, query);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Handle widget resize requests
    bridge.onMessage('RESIZE_REQUEST', (message, instanceId) => {
      const { width, height } = message.payload;

      if (width > 0 && height > 0 && width <= 2000 && height <= 2000) {
        onResize?.(instanceId, width, height);
        return { success: true };
      }

      return { success: false, error: 'Invalid dimensions' };
    });

    // Handle custom widget messages
    bridge.onMessage('WIDGET_MESSAGE', (message, instanceId) => {
      onMessage?.(instanceId, message.payload);
      return { success: true };
    });

    // Handle widget logs
    bridge.onMessage('LOG', (message, instanceId) => {
      const { level, message: logMessage } = message.payload;
      console.log(`[Widget ${instanceId}] ${level.toUpperCase()}: ${logMessage}`);
    });

    // Handle widget errors
    bridge.onMessage('ERROR', (message, instanceId) => {
      const error = message.payload;
      console.error(`[Widget ${instanceId}] Error:`, error);
      onError?.(instanceId, error);
    });
  }, [onResize, onMessage, onError]);

  /**
   * Setup runtime event handlers
   */
  const setupRuntimeHandlers = useCallback((runtime: WidgetRuntime) => {
    runtime.on('widgetReady', ({ instanceId }) => {
      console.log(`Widget ${instanceId} is ready`);
    });

    runtime.on('widgetError', ({ instanceId, error }) => {
      setState(prev => ({
        ...prev,
        hasError: true,
        error: error.message || 'Widget runtime error'
      }));
      onError?.(instanceId, error);
    });

    runtime.on('widgetResize', ({ instanceId, width, height }) => {
      onResize?.(instanceId, width, height);
    });

    runtime.on('securityViolation', ({ instanceId, message }) => {
      setState(prev => ({
        ...prev,
        securityViolations: prev.securityViolations + 1
      }));
      console.warn(`Security violation in widget ${instanceId}:`, message);
    });

    runtime.on('widgetInactive', ({ instanceId, inactiveTime }) => {
      console.log(`Widget ${instanceId} has been inactive for ${inactiveTime}ms`);
    });
  }, [onError, onResize]);

  /**
   * Handle data requests from widgets
   */
  const handleDataRequest = useCallback(async (dataType: string, query: any): Promise<any> => {
    // This would integrate with your data services
    switch (dataType) {
      case 'STOCK_PRICE':
        // Return mock data for now
        return {
          symbol: query.symbol,
          price: 150.25,
          change: 2.45,
          changePercent: 1.65,
          timestamp: Date.now()
        };

      case 'MARKET_DATA':
        return {
          indices: {
            SPY: { price: 450.25, change: 5.75 },
            QQQ: { price: 375.50, change: 3.25 },
            IWM: { price: 195.75, change: 1.85 }
          },
          timestamp: Date.now()
        };

      case 'USER_PREFERENCES':
        return {
          theme: 'dark',
          currency: 'USD',
          timezone: 'America/New_York'
        };

      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  }, []);

  /**
   * Send message to widget
   */
  const sendMessageToWidget = useCallback(async (type: string, payload: any) => {
    if (bridgeRef.current && state.isLoaded) {
      try {
        await bridgeRef.current.sendMessage(widget.id, type, payload);
      } catch (error) {
        console.error('Failed to send message to widget:', error);
      }
    }
  }, [widget.id, state.isLoaded]);

  /**
   * Cleanup runtime resources
   */
  const cleanup = useCallback(() => {
    if (runtimeRef.current) {
      runtimeRef.current.destroyWidget(widget.id);
      runtimeRef.current = null;
    }

    if (sandboxRef.current) {
      sandboxRef.current.stopMonitoring(widget.id);
      sandboxRef.current = null;
    }

    if (bridgeRef.current) {
      bridgeRef.current.disconnectChannel(widget.id);
      bridgeRef.current = null;
    }
  }, [widget.id]);

  /**
   * Reload widget
   */
  const reloadWidget = useCallback(() => {
    cleanup();
    setState({
      isLoading: false,
      isLoaded: false,
      hasError: false,
      securityViolations: 0,
      resourceUsage: { memory: 0, cpu: 0, network: 0 }
    });
    setTimeout(initializeRuntime, 100);
  }, [cleanup, initializeRuntime]);

  /**
   * Get widget status
   */
  const getWidgetStatus = useCallback(() => {
    return {
      instanceId: widget.id,
      widgetId: widget.widgetId,
      isLoading: state.isLoading,
      isLoaded: state.isLoaded,
      hasError: state.hasError,
      error: state.error,
      securityViolations: state.securityViolations,
      resourceUsage: state.resourceUsage,
      permissions,
      trustLevel
    };
  }, [widget, state, permissions, trustLevel]);

  // Expose methods for parent components
  React.useImperativeHandle(ref => ({
    sendMessage: sendMessageToWidget,
    reload: reloadWidget,
    getStatus: getWidgetStatus,
    cleanup
  }), [sendMessageToWidget, reloadWidget, getWidgetStatus, cleanup]);

  const containerStyle: React.CSSProperties = {
    width: widget.size.width,
    height: widget.size.height,
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    ...style
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 10
  };

  return (
    <div
      ref={containerRef}
      className={`widget-container ${className}`}
      style={containerStyle}
      data-widget-id={widget.widgetId}
      data-instance-id={widget.id}
      data-trust-level={trustLevel}
    >
      {/* Loading Overlay */}
      {state.isLoading && (
        <div style={overlayStyle}>
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
            <span className="text-sm text-gray-600">Loading widget...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {state.hasError && (
        <div style={overlayStyle}>
          <div className="text-center space-y-3">
            <div className="text-red-500 text-sm font-medium">Widget Error</div>
            <div className="text-xs text-gray-600 max-w-xs">
              {state.error || 'An unknown error occurred'}
            </div>
            <button
              onClick={reloadWidget}
              className="px-3 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Security Indicator */}
      {state.securityViolations > 0 && (
        <div
          className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full z-20"
          title={`${state.securityViolations} security violations detected`}
        >
          ⚠ {state.securityViolations}
        </div>
      )}

      {/* Widget content will be injected here by the runtime */}
    </div>
  );
};

export default WidgetContainer;