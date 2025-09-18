import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { WebSocketMessage, MarketUpdate, SentimentUpdate } from '@/types';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
  subscriptions: Set<string>;
  lastUpdate: WebSocketMessage | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { isAuthenticated, user, tokens } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<WebSocketMessage | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (isAuthenticated && user && tokens) {
      const clientId = `user-${user.id}`;
      const socketUrl = `${WS_URL}/${clientId}`;
      
      console.log('Connecting to WebSocket:', socketUrl);
      
      const newSocket = io(socketUrl, {
        transports: ['websocket'],
        auth: {
          token: tokens.access_token,
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 10000,
      });

      newSocket.on('connect', () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        toast.success('Real-time data connected', {
          id: 'ws-connected',
          duration: 2000,
        });
      });

      newSocket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          newSocket.connect();
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setIsConnected(false);
        toast.error('Real-time connection failed', {
          id: 'ws-error',
          duration: 3000,
        });
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('WebSocket reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
        toast.success('Real-time data reconnected', {
          id: 'ws-reconnected',
          duration: 2000,
        });

        // Re-subscribe to previous symbols
        if (subscriptions.size > 0) {
          const symbolsArray = Array.from(subscriptions);
          newSocket.emit('message', JSON.stringify({
            type: 'subscribe',
            symbols: symbolsArray,
          }));
        }
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('WebSocket reconnection error:', error);
        toast.error('Failed to reconnect to real-time data', {
          id: 'ws-reconnect-error',
          duration: 3000,
        });
      });

      // Handle incoming messages
      newSocket.on('message', (rawMessage: string) => {
        try {
          const message: WebSocketMessage = JSON.parse(rawMessage);
          setLastUpdate(message);
          
          // Handle different message types
          switch (message.type) {
            case 'connection_established':
              console.log('WebSocket connection established:', message);
              break;
              
            case 'subscription_confirmed':
              console.log('Subscription confirmed:', message);
              break;
              
            case 'market_update':
              handleMarketUpdate(message as MarketUpdate);
              break;
              
            case 'sentiment_update':
              handleSentimentUpdate(message as SentimentUpdate);
              break;
              
            case 'error':
              console.error('WebSocket error:', message);
              toast.error(`WebSocket error: ${message.data?.message || 'Unknown error'}`);
              break;
              
            default:
              console.log('Unknown message type:', message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error, rawMessage);
        }
      });

      setSocket(newSocket);

      return () => {
        console.log('Cleaning up WebSocket connection');
        newSocket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setSubscriptions(new Set());
      };
    }
  }, [isAuthenticated, user, tokens]);

  const subscribe = useCallback((symbols: string[]) => {
    if (!socket || !isConnected) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return;
    }

    console.log('Subscribing to symbols:', symbols);
    
    const message = {
      type: 'subscribe',
      symbols: symbols,
    };

    socket.emit('message', JSON.stringify(message));
    
    // Update local subscriptions
    setSubscriptions(prev => {
      const newSet = new Set(prev);
      symbols.forEach(symbol => newSet.add(symbol.toUpperCase()));
      return newSet;
    });
  }, [socket, isConnected]);

  const unsubscribe = useCallback((symbols: string[]) => {
    if (!socket || !isConnected) {
      console.warn('Cannot unsubscribe: WebSocket not connected');
      return;
    }

    console.log('Unsubscribing from symbols:', symbols);
    
    const message = {
      type: 'unsubscribe',
      symbols: symbols,
    };

    socket.emit('message', JSON.stringify(message));
    
    // Update local subscriptions
    setSubscriptions(prev => {
      const newSet = new Set(prev);
      symbols.forEach(symbol => newSet.delete(symbol.toUpperCase()));
      return newSet;
    });
  }, [socket, isConnected]);

  const handleMarketUpdate = (update: MarketUpdate) => {
    console.log('Market update received:', update);
    
    // Dispatch custom event for components to listen to
    window.dispatchEvent(new CustomEvent('market-update', {
      detail: update
    }));
  };

  const handleSentimentUpdate = (update: SentimentUpdate) => {
    console.log('Sentiment update received:', update);
    
    // Dispatch custom event for components to listen to
    window.dispatchEvent(new CustomEvent('sentiment-update', {
      detail: update
    }));
  };

  const value: WebSocketContextType = {
    socket,
    isConnected,
    subscribe,
    unsubscribe,
    subscriptions,
    lastUpdate,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  
  return context;
}

// Custom hook for subscribing to specific symbols
export function useMarketData(symbols: string[]) {
  const { subscribe, unsubscribe, isConnected } = useWebSocket();
  const [marketData, setMarketData] = useState<Record<string, MarketUpdate>>({});

  useEffect(() => {
    if (isConnected && symbols.length > 0) {
      subscribe(symbols);
      
      return () => {
        unsubscribe(symbols);
      };
    }
  }, [symbols, subscribe, unsubscribe, isConnected]);

  useEffect(() => {
    const handleMarketUpdate = (event: CustomEvent<MarketUpdate>) => {
      const update = event.detail;
      setMarketData(prev => ({
        ...prev,
        [update.symbol]: update,
      }));
    };

    window.addEventListener('market-update', handleMarketUpdate as EventListener);
    
    return () => {
      window.removeEventListener('market-update', handleMarketUpdate as EventListener);
    };
  }, []);

  return {
    marketData,
    isConnected,
  };
}

// Custom hook for sentiment updates
export function useSentimentData(symbols: string[]) {
  const { subscribe, unsubscribe, isConnected } = useWebSocket();
  const [sentimentData, setSentimentData] = useState<Record<string, SentimentUpdate>>({});

  useEffect(() => {
    if (isConnected && symbols.length > 0) {
      subscribe(symbols);
      
      return () => {
        unsubscribe(symbols);
      };
    }
  }, [symbols, subscribe, unsubscribe, isConnected]);

  useEffect(() => {
    const handleSentimentUpdate = (event: CustomEvent<SentimentUpdate>) => {
      const update = event.detail;
      setSentimentData(prev => ({
        ...prev,
        [update.symbol]: update,
      }));
    };

    window.addEventListener('sentiment-update', handleSentimentUpdate as EventListener);
    
    return () => {
      window.removeEventListener('sentiment-update', handleSentimentUpdate as EventListener);
    };
  }, []);

  return {
    sentimentData,
    isConnected,
  };
}