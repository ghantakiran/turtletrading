import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Maximize2, Settings, Download, Share2 } from 'lucide-react';

interface ChartDataPoint {
  timestamp: string;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change?: number;
  changePercent?: number;
}

interface InteractiveChartProps {
  data: ChartDataPoint[];
  symbol: string;
  timeframe?: '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | 'MAX';
  chartType?: 'line' | 'candlestick' | 'area';
  showVolume?: boolean;
  showTechnicalIndicators?: boolean;
  height?: number;
  onTimeframeChange?: (timeframe: string) => void;
}

const InteractiveChart: React.FC<InteractiveChartProps> = ({
  data,
  symbol,
  timeframe = '1D',
  chartType = 'line',
  showVolume = true,
  showTechnicalIndicators = false,
  height = 400,
  onTimeframeChange
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);
  const [selectedChartType, setSelectedChartType] = useState(chartType);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const timeframes = ['1D', '5D', '1M', '3M', '6M', '1Y', '2Y', '5Y', 'MAX'];
  const chartTypes = [
    { type: 'line', label: 'Line', icon: '📈' },
    { type: 'candlestick', label: 'Candlestick', icon: '🕯️' },
    { type: 'area', label: 'Area', icon: '📊' },
  ];

  // Calculate chart dimensions and scales
  const { chartData, priceScale, volumeScale, dimensions } = useMemo(() => {
    if (!data.length) return { chartData: [], priceScale: { min: 0, max: 0 }, volumeScale: { min: 0, max: 0 }, dimensions: { width: 0, height: 0 } };

    const prices = data.flatMap(d => [d.open, d.high, d.low, d.close]);
    const volumes = data.map(d => d.volume);

    const priceMin = Math.min(...prices);
    const priceMax = Math.max(...prices);
    const volumeMin = Math.min(...volumes);
    const volumeMax = Math.max(...volumes);

    const padding = (priceMax - priceMin) * 0.1;

    return {
      chartData: data,
      priceScale: {
        min: priceMin - padding,
        max: priceMax + padding
      },
      volumeScale: {
        min: volumeMin,
        max: volumeMax
      },
      dimensions: {
        width: 800,
        height: height
      }
    };
  }, [data, height]);

  // Generate SVG path for line chart
  const generateLinePath = () => {
    if (!chartData.length) return '';

    const points = chartData.map((point, index) => {
      const x = (index / (chartData.length - 1)) * dimensions.width;
      const y = dimensions.height - ((point.close - priceScale.min) / (priceScale.max - priceScale.min)) * (dimensions.height * 0.7);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  // Generate area path
  const generateAreaPath = () => {
    const linePath = generateLinePath();
    if (!linePath) return '';

    const lastPoint = chartData[chartData.length - 1];
    if (!lastPoint) return '';

    const endX = dimensions.width;
    const bottomY = dimensions.height * 0.7;

    return `${linePath} L ${endX},${bottomY} L 0,${bottomY} Z`;
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
    return volume.toString();
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const handleTimeframeChange = (newTimeframe: string) => {
    setSelectedTimeframe(newTimeframe);
    onTimeframeChange?.(newTimeframe);
  };

  const currentPrice = chartData[chartData.length - 1]?.close || 0;
  const previousPrice = chartData[chartData.length - 2]?.close || currentPrice;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = previousPrice ? (priceChange / previousPrice) * 100 : 0;
  const isPositive = priceChange >= 0;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Chart Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
              <BarChart3 className="w-6 h-6 text-primary-500" />
              <span>{symbol}</span>
            </h2>
            <div className="flex items-center space-x-4 mt-1">
              <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {formatPrice(hoveredPoint?.close || currentPrice)}
              </span>
              <div className={`flex items-center space-x-1 text-lg font-semibold ${
                isPositive ? 'text-bull-600 dark:text-bull-400' : 'text-bear-600 dark:text-bear-400'
              }`}>
                {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                <span>{isPositive ? '+' : ''}{formatPrice(priceChange)}</span>
                <span>({priceChangePercent.toFixed(2)}%)</span>
              </div>
            </div>
          </div>

          {hoveredPoint && (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatDate(hoveredPoint.date)}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Open: </span>
                  <span className="font-semibold">{formatPrice(hoveredPoint.open)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">High: </span>
                  <span className="font-semibold">{formatPrice(hoveredPoint.high)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Low: </span>
                  <span className="font-semibold">{formatPrice(hoveredPoint.low)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Volume: </span>
                  <span className="font-semibold">{formatVolume(hoveredPoint.volume)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chart Controls */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {chartTypes.map((type) => (
              <button
                key={type.type}
                onClick={() => setSelectedChartType(type.type as any)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  selectedChartType === type.type
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
                title={type.label}
              >
                {type.icon}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Maximize2 className="w-5 h-5" />
          </button>

          <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <Settings className="w-5 h-5" />
          </button>

          <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <Download className="w-5 h-5" />
          </button>

          <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center space-x-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                selectedTimeframe === tf
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showVolume}
              onChange={(e) => {/* Handle volume toggle */}}
              className="rounded"
            />
            <span>Volume</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showTechnicalIndicators}
              onChange={(e) => {/* Handle indicators toggle */}}
              className="rounded"
            />
            <span>Indicators</span>
          </label>
        </div>
      </div>

      {/* Chart Container */}
      <div ref={chartRef} className="relative p-6">
        <div
          className="relative overflow-hidden rounded-lg"
          style={{ height: `${height}px` }}
        >
          {/* Main Chart SVG */}
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="absolute inset-0"
          >
            {/* Grid Lines */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgb(229, 231, 235)" strokeWidth="0.5" opacity="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Chart based on type */}
            {selectedChartType === 'area' && (
              <>
                <defs>
                  <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: isPositive ? '#22c55e' : '#ef4444', stopOpacity: 0.3 }} />
                    <stop offset="100%" style={{ stopColor: isPositive ? '#22c55e' : '#ef4444', stopOpacity: 0.05 }} />
                  </linearGradient>
                </defs>
                <path
                  d={generateAreaPath()}
                  fill="url(#areaGradient)"
                  stroke={isPositive ? '#22c55e' : '#ef4444'}
                  strokeWidth="2"
                />
              </>
            )}

            {selectedChartType === 'line' && (
              <path
                d={generateLinePath()}
                fill="none"
                stroke={isPositive ? '#22c55e' : '#ef4444'}
                strokeWidth="2"
                className="drop-shadow-sm"
              />
            )}

            {selectedChartType === 'candlestick' && chartData.map((point, index) => {
              const x = (index / (chartData.length - 1)) * dimensions.width;
              const yOpen = dimensions.height - ((point.open - priceScale.min) / (priceScale.max - priceScale.min)) * (dimensions.height * 0.7);
              const yClose = dimensions.height - ((point.close - priceScale.min) / (priceScale.max - priceScale.min)) * (dimensions.height * 0.7);
              const yHigh = dimensions.height - ((point.high - priceScale.min) / (priceScale.max - priceScale.min)) * (dimensions.height * 0.7);
              const yLow = dimensions.height - ((point.low - priceScale.min) / (priceScale.max - priceScale.min)) * (dimensions.height * 0.7);
              const isGreen = point.close >= point.open;
              const candleWidth = Math.max(2, dimensions.width / chartData.length * 0.6);

              return (
                <g key={index}>
                  {/* Wick */}
                  <line
                    x1={x}
                    y1={yHigh}
                    x2={x}
                    y2={yLow}
                    stroke={isGreen ? '#22c55e' : '#ef4444'}
                    strokeWidth="1"
                  />
                  {/* Body */}
                  <rect
                    x={x - candleWidth / 2}
                    y={Math.min(yOpen, yClose)}
                    width={candleWidth}
                    height={Math.abs(yClose - yOpen) || 1}
                    fill={isGreen ? '#22c55e' : '#ef4444'}
                    stroke={isGreen ? '#22c55e' : '#ef4444'}
                    strokeWidth="1"
                  />
                </g>
              );
            })}

            {/* Hover Points */}
            {chartData.map((point, index) => {
              const x = (index / (chartData.length - 1)) * dimensions.width;
              const y = dimensions.height - ((point.close - priceScale.min) / (priceScale.max - priceScale.min)) * (dimensions.height * 0.7);

              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="4"
                  fill={isPositive ? '#22c55e' : '#ef4444'}
                  stroke="white"
                  strokeWidth="2"
                  className="opacity-0 hover:opacity-100 cursor-pointer transition-opacity"
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              );
            })}
          </svg>

          {/* Volume Chart */}
          {showVolume && (
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg">
              <svg width="100%" height="100%" viewBox={`0 0 ${dimensions.width} 80`}>
                {chartData.map((point, index) => {
                  const x = (index / (chartData.length - 1)) * dimensions.width;
                  const height = (point.volume / volumeScale.max) * 60;
                  const barWidth = Math.max(1, dimensions.width / chartData.length * 0.8);
                  const isGreen = index === 0 ? true : point.close >= chartData[index - 1].close;

                  return (
                    <rect
                      key={index}
                      x={x - barWidth / 2}
                      y={80 - height}
                      width={barWidth}
                      height={height}
                      fill={isGreen ? '#22c55e' : '#ef4444'}
                      opacity="0.6"
                    />
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractiveChart;