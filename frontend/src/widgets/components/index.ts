/**
 * Embeddable Widget Components - Main Exports
 * Comprehensive set of trading-focused widget components
 */

// Core Widget Components
export { default as StockPriceWidget } from './StockPriceWidget';
export { default as MarketOverviewWidget } from './MarketOverviewWidget';
export { default as TradingNewsWidget } from './TradingNewsWidget';
export { default as PortfolioWidget } from './PortfolioWidget';

// Widget Component Registry
export const WIDGET_COMPONENTS = {
  'stock-price': StockPriceWidget,
  'market-overview': MarketOverviewWidget,
  'trading-news': TradingNewsWidget,
  'portfolio': PortfolioWidget
} as const;

// Widget Component Types
export type WidgetComponentType = keyof typeof WIDGET_COMPONENTS;

// Widget Metadata for Registration
export const WIDGET_METADATA = {
  'stock-price': {
    name: 'Stock Price',
    description: 'Real-time stock price with mini chart and key metrics',
    category: 'market-data',
    permissions: ['network_access'],
    defaultSize: { width: 400, height: 300 },
    minSize: { width: 300, height: 200 },
    maxSize: { width: 600, height: 500 },
    thumbnail: '/widget-thumbnails/stock-price.png',
    tags: ['stocks', 'price', 'real-time', 'chart'],
    author: 'TurtleTrading',
    version: '1.0.0'
  },
  'market-overview': {
    name: 'Market Overview',
    description: 'Comprehensive market indices, sectors, and breadth analysis',
    category: 'market-data',
    permissions: ['network_access'],
    defaultSize: { width: 500, height: 400 },
    minSize: { width: 400, height: 300 },
    maxSize: { width: 800, height: 600 },
    thumbnail: '/widget-thumbnails/market-overview.png',
    tags: ['market', 'indices', 'sectors', 'breadth'],
    author: 'TurtleTrading',
    version: '1.0.0'
  },
  'trading-news': {
    name: 'Trading News',
    description: 'Financial news with sentiment analysis and trending symbols',
    category: 'news',
    permissions: ['network_access'],
    defaultSize: { width: 450, height: 500 },
    minSize: { width: 350, height: 400 },
    maxSize: { width: 700, height: 800 },
    thumbnail: '/widget-thumbnails/trading-news.png',
    tags: ['news', 'sentiment', 'trending', 'analysis'],
    author: 'TurtleTrading',
    version: '1.0.0'
  },
  'portfolio': {
    name: 'Portfolio Performance',
    description: 'Portfolio holdings, performance tracking, and allocation analysis',
    category: 'portfolio',
    permissions: ['network_access', 'user_data'],
    defaultSize: { width: 500, height: 450 },
    minSize: { width: 400, height: 350 },
    maxSize: { width: 800, height: 700 },
    thumbnail: '/widget-thumbnails/portfolio.png',
    tags: ['portfolio', 'performance', 'holdings', 'allocation'],
    author: 'TurtleTrading',
    version: '1.0.0'
  }
} as const;

// Widget Factory Function
export function createWidgetComponent(
  type: WidgetComponentType,
  props: any
): React.ComponentType<any> | null {
  const Component = WIDGET_COMPONENTS[type];
  return Component || null;
}

// Widget Validation
export function isValidWidgetType(type: string): type is WidgetComponentType {
  return type in WIDGET_COMPONENTS;
}

// Widget Discovery
export function getAvailableWidgets(): Array<{
  type: WidgetComponentType;
  metadata: typeof WIDGET_METADATA[WidgetComponentType];
}> {
  return Object.entries(WIDGET_METADATA).map(([type, metadata]) => ({
    type: type as WidgetComponentType,
    metadata
  }));
}

// Widget Categories
export const WIDGET_CATEGORIES = {
  'market-data': {
    name: 'Market Data',
    description: 'Real-time market information and price data',
    icon: '📊'
  },
  'news': {
    name: 'News & Analysis',
    description: 'Financial news and market sentiment analysis',
    icon: '📰'
  },
  'portfolio': {
    name: 'Portfolio Management',
    description: 'Portfolio tracking and performance analysis',
    icon: '💼'
  },
  'analysis': {
    name: 'Technical Analysis',
    description: 'Charts, indicators, and trading signals',
    icon: '📈'
  },
  'alerts': {
    name: 'Alerts & Notifications',
    description: 'Price alerts and trading notifications',
    icon: '🔔'
  }
} as const;

// Widget Default Configurations
export const WIDGET_DEFAULT_CONFIGS = {
  'stock-price': {
    symbol: 'AAPL',
    refreshInterval: 5000,
    showChart: true,
    chartPeriod: '1D'
  },
  'market-overview': {
    indices: ['SPY', 'QQQ', 'IWM'],
    layout: 'grid',
    showSectors: true,
    showBreadth: true,
    refreshInterval: 30000
  },
  'trading-news': {
    maxArticles: 10,
    categories: ['general', 'earnings', 'technology'],
    showSentiment: true,
    showImages: true,
    refreshInterval: 60000
  },
  'portfolio': {
    portfolioId: 'default',
    maxHoldings: 10,
    showPerformanceChart: true,
    showAllocation: true,
    refreshInterval: 30000
  }
} as const;

// Widget Utilities
export const WidgetUtils = {
  /**
   * Get widget component by type
   */
  getComponent(type: WidgetComponentType): React.ComponentType<any> | null {
    return WIDGET_COMPONENTS[type] || null;
  },

  /**
   * Get widget metadata by type
   */
  getMetadata(type: WidgetComponentType) {
    return WIDGET_METADATA[type];
  },

  /**
   * Get default configuration for widget type
   */
  getDefaultConfig(type: WidgetComponentType) {
    return WIDGET_DEFAULT_CONFIGS[type] || {};
  },

  /**
   * Get widgets by category
   */
  getWidgetsByCategory(category: string) {
    return Object.entries(WIDGET_METADATA)
      .filter(([, metadata]) => metadata.category === category)
      .map(([type, metadata]) => ({ type: type as WidgetComponentType, metadata }));
  },

  /**
   * Search widgets by query
   */
  searchWidgets(query: string) {
    const searchTerm = query.toLowerCase();
    return Object.entries(WIDGET_METADATA)
      .filter(([type, metadata]) =>
        type.toLowerCase().includes(searchTerm) ||
        metadata.name.toLowerCase().includes(searchTerm) ||
        metadata.description.toLowerCase().includes(searchTerm) ||
        metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      )
      .map(([type, metadata]) => ({ type: type as WidgetComponentType, metadata }));
  },

  /**
   * Validate widget configuration
   */
  validateConfig(type: WidgetComponentType, config: any): boolean {
    // Basic validation - could be expanded with proper schema validation
    const defaultConfig = WIDGET_DEFAULT_CONFIGS[type];
    if (!defaultConfig) return false;

    // Check required fields exist
    return Object.keys(defaultConfig).every(key => key in config);
  },

  /**
   * Merge config with defaults
   */
  mergeWithDefaults(type: WidgetComponentType, config: any) {
    const defaults = WIDGET_DEFAULT_CONFIGS[type] || {};
    return { ...defaults, ...config };
  },

  /**
   * Get widget size constraints
   */
  getSizeConstraints(type: WidgetComponentType) {
    const metadata = WIDGET_METADATA[type];
    if (!metadata) return null;

    return {
      default: metadata.defaultSize,
      min: metadata.minSize,
      max: metadata.maxSize
    };
  },

  /**
   * Check if widget supports feature
   */
  supportsFeature(type: WidgetComponentType, feature: string): boolean {
    const metadata = WIDGET_METADATA[type];
    if (!metadata) return false;

    // Check if feature is in permissions or tags
    return metadata.permissions.includes(feature as any) ||
           metadata.tags.includes(feature);
  },

  /**
   * Get widget embed code
   */
  generateEmbedCode(type: WidgetComponentType, config: any, instanceId: string): string {
    const metadata = WIDGET_METADATA[type];
    if (!metadata) return '';

    return `
<!-- TurtleTrading Widget: ${metadata.name} -->
<div
  id="turtle-widget-${instanceId}"
  data-widget-type="${type}"
  data-widget-config='${JSON.stringify(config)}'
  style="width: ${metadata.defaultSize.width}px; height: ${metadata.defaultSize.height}px;"
></div>
<script>
  // Widget initialization code would go here
  console.log('TurtleTrading Widget: ${metadata.name} loaded');
</script>`;
  }
};

// Widget Performance Metrics
export interface WidgetMetrics {
  loadTime: number;
  renderTime: number;
  dataFetchTime: number;
  errorCount: number;
  refreshCount: number;
  userInteractions: number;
  memoryUsage: number;
}

// Widget Error Types
export class WidgetError extends Error {
  constructor(
    message: string,
    public widgetType: WidgetComponentType,
    public instanceId: string,
    public code?: string
  ) {
    super(message);
    this.name = 'WidgetError';
  }
}

export class WidgetDataError extends WidgetError {
  constructor(
    message: string,
    widgetType: WidgetComponentType,
    instanceId: string,
    public dataSource?: string
  ) {
    super(message, widgetType, instanceId, 'DATA_ERROR');
    this.name = 'WidgetDataError';
  }
}

export class WidgetConfigError extends WidgetError {
  constructor(
    message: string,
    widgetType: WidgetComponentType,
    instanceId: string,
    public configField?: string
  ) {
    super(message, widgetType, instanceId, 'CONFIG_ERROR');
    this.name = 'WidgetConfigError';
  }
}

export default {
  WIDGET_COMPONENTS,
  WIDGET_METADATA,
  WIDGET_CATEGORIES,
  WIDGET_DEFAULT_CONFIGS,
  WidgetUtils,
  createWidgetComponent,
  isValidWidgetType,
  getAvailableWidgets,
  WidgetError,
  WidgetDataError,
  WidgetConfigError
};