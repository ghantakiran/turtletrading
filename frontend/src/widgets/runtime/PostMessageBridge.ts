/**
 * PostMessage Communication Bridge
 * Secure communication between host application and widget iframes
 */

import { EventEmitter } from 'events';

export interface BridgeMessage {
  id: string;
  type: string;
  source: string;
  target: string;
  payload: any;
  timestamp: number;
  signature?: string;
  requestId?: string;
}

export interface BridgeResponse {
  id: string;
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

export interface CommunicationChannel {
  id: string;
  widgetId: string;
  instanceId: string;
  origin: string;
  window: Window;
  port?: MessagePort;
  isConnected: boolean;
  lastActivity: number;
  messageQueue: BridgeMessage[];
}

export interface BridgeConfig {
  allowedOrigins: string[];
  messageTimeout: number;
  maxQueueSize: number;
  enableEncryption: boolean;
  rateLimitPerSecond: number;
}

export class PostMessageBridge extends EventEmitter {
  private channels: Map<string, CommunicationChannel> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private config: BridgeConfig;
  private rateLimiter: Map<string, number[]> = new Map();

  constructor(config: BridgeConfig) {
    super();
    this.config = config;
    this.setupGlobalMessageListener();
    this.startMaintenanceTasks();
  }

  /**
   * Register a new widget communication channel
   */
  public registerChannel(
    instanceId: string,
    widgetId: string,
    targetWindow: Window,
    origin: string
  ): CommunicationChannel {
    const channel: CommunicationChannel = {
      id: `channel_${instanceId}`,
      widgetId,
      instanceId,
      origin,
      window: targetWindow,
      isConnected: false,
      lastActivity: Date.now(),
      messageQueue: []
    };

    this.channels.set(instanceId, channel);

    // Initialize MessageChannel for secure communication
    this.initializeMessageChannel(channel);

    this.emit('channelRegistered', { instanceId, widgetId });
    return channel;
  }

  /**
   * Send message to specific widget
   */
  public async sendMessage(
    instanceId: string,
    type: string,
    payload: any,
    expectResponse: boolean = false
  ): Promise<any> {
    const channel = this.channels.get(instanceId);
    if (!channel || !channel.isConnected) {
      throw new Error(`Widget ${instanceId} is not connected`);
    }

    // Check rate limiting
    if (!this.checkRateLimit(instanceId)) {
      throw new Error(`Rate limit exceeded for widget ${instanceId}`);
    }

    const message: BridgeMessage = {
      id: this.generateMessageId(),
      type,
      source: 'host',
      target: instanceId,
      payload,
      timestamp: Date.now()
    };

    if (expectResponse) {
      return this.sendMessageWithResponse(channel, message);
    } else {
      this.sendMessageOneWay(channel, message);
      return Promise.resolve();
    }
  }

  /**
   * Send broadcast message to all connected widgets
   */
  public broadcastMessage(type: string, payload: any): void {
    const message: BridgeMessage = {
      id: this.generateMessageId(),
      type,
      source: 'host',
      target: 'all',
      payload,
      timestamp: Date.now()
    };

    this.channels.forEach((channel) => {
      if (channel.isConnected) {
        this.sendMessageOneWay(channel, message);
      }
    });

    this.emit('messageBroadcast', { type, payload, channelCount: this.channels.size });
  }

  /**
   * Register message handler for specific message type
   */
  public onMessage(type: string, handler: MessageHandler): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Remove message handler
   */
  public offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  /**
   * Disconnect and cleanup widget channel
   */
  public disconnectChannel(instanceId: string): void {
    const channel = this.channels.get(instanceId);
    if (!channel) return;

    channel.isConnected = false;

    if (channel.port) {
      channel.port.close();
    }

    // Clear pending requests for this channel
    this.pendingRequests.forEach((request, requestId) => {
      if (request.instanceId === instanceId) {
        request.reject(new Error('Channel disconnected'));
        this.pendingRequests.delete(requestId);
      }
    });

    this.channels.delete(instanceId);
    this.rateLimiter.delete(instanceId);

    this.emit('channelDisconnected', { instanceId });
  }

  /**
   * Get channel statistics
   */
  public getChannelStats(): {
    totalChannels: number;
    connectedChannels: number;
    pendingRequests: number;
    totalMessages: number;
  } {
    const connectedChannels = Array.from(this.channels.values())
      .filter(channel => channel.isConnected).length;

    return {
      totalChannels: this.channels.size,
      connectedChannels,
      pendingRequests: this.pendingRequests.size,
      totalMessages: this.getTotalMessageCount()
    };
  }

  /**
   * Initialize MessageChannel for secure communication
   */
  private initializeMessageChannel(channel: CommunicationChannel): void {
    const messageChannel = new MessageChannel();
    channel.port = messageChannel.port1;

    // Setup message handler for this channel
    channel.port.onmessage = (event) => {
      this.handleWidgetMessage(channel.instanceId, event.data);
    };

    // Send initialization message with port transfer
    const initMessage = {
      type: 'BRIDGE_INIT',
      instanceId: channel.instanceId,
      timestamp: Date.now()
    };

    channel.window.postMessage(initMessage, channel.origin, [messageChannel.port2]);

    // Wait for connection confirmation
    const connectionTimeout = setTimeout(() => {
      if (!channel.isConnected) {
        this.emit('connectionTimeout', { instanceId: channel.instanceId });
      }
    }, this.config.messageTimeout);

    // Listen for connection confirmation
    const confirmationHandler = (event: MessageEvent) => {
      if (event.source === channel.window &&
          event.data.type === 'BRIDGE_CONNECTED' &&
          event.data.instanceId === channel.instanceId) {

        clearTimeout(connectionTimeout);
        channel.isConnected = true;
        channel.lastActivity = Date.now();

        // Process queued messages
        this.processQueuedMessages(channel);

        window.removeEventListener('message', confirmationHandler);
        this.emit('channelConnected', { instanceId: channel.instanceId });
      }
    };

    window.addEventListener('message', confirmationHandler);
  }

  /**
   * Send message with response expectation
   */
  private sendMessageWithResponse(
    channel: CommunicationChannel,
    message: BridgeMessage
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateMessageId();
      message.requestId = requestId;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Message timeout: ${message.type}`));
      }, this.config.messageTimeout);

      this.pendingRequests.set(requestId, {
        instanceId: channel.instanceId,
        resolve,
        reject,
        timeout,
        timestamp: Date.now()
      });

      this.sendMessageOneWay(channel, message);
    });
  }

  /**
   * Send one-way message
   */
  private sendMessageOneWay(channel: CommunicationChannel, message: BridgeMessage): void {
    if (!channel.isConnected) {
      // Queue message if not connected
      if (channel.messageQueue.length < this.config.maxQueueSize) {
        channel.messageQueue.push(message);
      }
      return;
    }

    try {
      if (channel.port) {
        channel.port.postMessage(message);
      } else {
        channel.window.postMessage(message, channel.origin);
      }

      channel.lastActivity = Date.now();
      this.emit('messageSent', { instanceId: channel.instanceId, type: message.type });
    } catch (error) {
      this.emit('sendError', {
        instanceId: channel.instanceId,
        error: error.message,
        messageType: message.type
      });
    }
  }

  /**
   * Handle incoming message from widget
   */
  private handleWidgetMessage(instanceId: string, message: BridgeMessage): void {
    const channel = this.channels.get(instanceId);
    if (!channel) return;

    // Validate message structure
    if (!this.validateMessage(message)) {
      this.emit('invalidMessage', { instanceId, message });
      return;
    }

    // Check rate limiting
    if (!this.checkRateLimit(instanceId)) {
      this.emit('rateLimitExceeded', { instanceId });
      return;
    }

    channel.lastActivity = Date.now();

    // Handle response messages
    if (message.requestId) {
      this.handleResponseMessage(message);
      return;
    }

    // Handle regular messages
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      try {
        const result = handler(message, instanceId);

        // Send response if handler returns a promise or value
        if (result !== undefined) {
          this.sendResponse(channel, message, true, result);
        }
      } catch (error) {
        this.sendResponse(channel, message, false, null, error.message);
        this.emit('handlerError', { instanceId, messageType: message.type, error: error.message });
      }
    } else {
      // Emit unhandled message event
      this.emit('unhandledMessage', { instanceId, message });
    }
  }

  /**
   * Handle response message for pending request
   */
  private handleResponseMessage(message: BridgeMessage): void {
    const request = this.pendingRequests.get(message.requestId!);
    if (!request) return;

    clearTimeout(request.timeout);
    this.pendingRequests.delete(message.requestId!);

    if (message.type === 'RESPONSE_SUCCESS') {
      request.resolve(message.payload);
    } else if (message.type === 'RESPONSE_ERROR') {
      request.reject(new Error(message.payload?.error || 'Unknown error'));
    }
  }

  /**
   * Send response to widget message
   */
  private sendResponse(
    channel: CommunicationChannel,
    originalMessage: BridgeMessage,
    success: boolean,
    data?: any,
    error?: string
  ): void {
    const response: BridgeMessage = {
      id: this.generateMessageId(),
      type: success ? 'RESPONSE_SUCCESS' : 'RESPONSE_ERROR',
      source: 'host',
      target: originalMessage.source,
      payload: success ? data : { error },
      timestamp: Date.now(),
      requestId: originalMessage.id
    };

    this.sendMessageOneWay(channel, response);
  }

  /**
   * Setup global message listener for initial connections
   */
  private setupGlobalMessageListener(): void {
    window.addEventListener('message', (event) => {
      // Handle initial bridge connection messages
      if (event.data?.type === 'BRIDGE_CONNECT_REQUEST') {
        this.handleConnectionRequest(event);
      }
    });
  }

  /**
   * Handle widget connection request
   */
  private handleConnectionRequest(event: MessageEvent): void {
    const { instanceId, widgetId } = event.data;

    if (!instanceId || !widgetId) return;

    // Validate origin
    if (!this.isAllowedOrigin(event.origin)) {
      this.emit('unauthorizedConnection', {
        instanceId,
        widgetId,
        origin: event.origin
      });
      return;
    }

    // Find existing channel
    const channel = this.channels.get(instanceId);
    if (channel && event.source === channel.window) {
      // Reinitialize connection
      this.initializeMessageChannel(channel);
    }
  }

  /**
   * Process queued messages for newly connected channel
   */
  private processQueuedMessages(channel: CommunicationChannel): void {
    const queuedMessages = [...channel.messageQueue];
    channel.messageQueue = [];

    queuedMessages.forEach(message => {
      this.sendMessageOneWay(channel, message);
    });

    if (queuedMessages.length > 0) {
      this.emit('queuedMessagesProcessed', {
        instanceId: channel.instanceId,
        count: queuedMessages.length
      });
    }
  }

  /**
   * Validate message structure and content
   */
  private validateMessage(message: BridgeMessage): boolean {
    return !!(
      message &&
      message.id &&
      message.type &&
      message.source &&
      message.timestamp &&
      typeof message.timestamp === 'number' &&
      Date.now() - message.timestamp < 30000 // Max 30 seconds old
    );
  }

  /**
   * Check if origin is allowed
   */
  private isAllowedOrigin(origin: string): boolean {
    return this.config.allowedOrigins.includes('*') ||
           this.config.allowedOrigins.includes(origin) ||
           this.config.allowedOrigins.some(allowed =>
             allowed.startsWith('*.') &&
             origin.endsWith(allowed.slice(1))
           );
  }

  /**
   * Check rate limiting for widget
   */
  private checkRateLimit(instanceId: string): boolean {
    const now = Date.now();
    const windowMs = 1000; // 1 second window

    let requests = this.rateLimiter.get(instanceId) || [];

    // Remove old requests outside the window
    requests = requests.filter(timestamp => now - timestamp < windowMs);

    // Check if under rate limit
    if (requests.length >= this.config.rateLimitPerSecond) {
      return false;
    }

    // Add current request
    requests.push(now);
    this.rateLimiter.set(instanceId, requests);

    return true;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get total message count across all channels
   */
  private getTotalMessageCount(): number {
    return Array.from(this.channels.values())
      .reduce((total, channel) => total + channel.messageQueue.length, 0) +
      this.pendingRequests.size;
  }

  /**
   * Start maintenance tasks
   */
  private startMaintenanceTasks(): void {
    // Cleanup inactive channels
    setInterval(() => {
      this.cleanupInactiveChannels();
    }, 60000); // Every minute

    // Cleanup expired pending requests
    setInterval(() => {
      this.cleanupExpiredRequests();
    }, 30000); // Every 30 seconds

    // Reset rate limiters
    setInterval(() => {
      this.rateLimiter.clear();
    }, 60000); // Every minute
  }

  /**
   * Cleanup inactive channels
   */
  private cleanupInactiveChannels(): void {
    const now = Date.now();
    const inactiveThreshold = 300000; // 5 minutes

    this.channels.forEach((channel, instanceId) => {
      if (now - channel.lastActivity > inactiveThreshold) {
        this.emit('channelInactive', { instanceId, lastActivity: channel.lastActivity });
        this.disconnectChannel(instanceId);
      }
    });
  }

  /**
   * Cleanup expired pending requests
   */
  private cleanupExpiredRequests(): void {
    const now = Date.now();

    this.pendingRequests.forEach((request, requestId) => {
      if (now - request.timestamp > this.config.messageTimeout) {
        clearTimeout(request.timeout);
        request.reject(new Error('Request expired'));
        this.pendingRequests.delete(requestId);
      }
    });
  }
}

interface PendingRequest {
  instanceId: string;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: number;
  timestamp: number;
}

type MessageHandler = (message: BridgeMessage, instanceId: string) => any;

export default PostMessageBridge;