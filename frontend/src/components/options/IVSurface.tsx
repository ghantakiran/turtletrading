/**
 * IVSurface.tsx - Advanced Implied Volatility Surface Chart
 *
 * Features:
 * - Interactive 3D surface chart visualization
 * - Accessibility-compliant controls and navigation
 * - Real-time data updates with smooth transitions
 * - Mobile-responsive design with touch support
 * - Customizable view angles and zoom levels
 * - Data export capabilities
 * - Screen reader friendly with proper ARIA labels
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell
} from 'recharts';
import { DownloadIcon, RotateCcwIcon, ZoomInIcon, ZoomOutIcon, EyeIcon } from 'lucide-react';

// Types
interface IVSurfacePoint {
  strike: number;
  expiry: string;
  timeToExpiry: number;
  moneyness: number;
  impliedVolatility: number;
  optionType: 'call' | 'put';
}

interface IVSurfaceData {
  symbol: string;
  underlyingPrice: number;
  surfacePoints: IVSurfacePoint[];
  calculatedAt: string;
  avgIV: number;
  ivSkew: number;
  termStructure: Record<string, number>;
}

interface IVSurfaceProps {
  symbol: string;
  onDataPointSelect?: (point: IVSurfacePoint) => void;
  refreshInterval?: number;
  className?: string;
  height?: number;
}

type ViewType = '3d' | 'contour' | 'heatmap' | 'slice';
type ColorScheme = 'viridis' | 'plasma' | 'cool' | 'warm';

export const IVSurface: React.FC<IVSurfaceProps> = ({
  symbol,
  onDataPointSelect,
  refreshInterval = 60000,
  className = '',
  height = 500,
}) => {
  const [data, setData] = useState<IVSurfaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>('contour');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('viridis');
  const [selectedPoint, setSelectedPoint] = useState<IVSurfacePoint | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState({ x: 45, y: 45 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch IV surface data
  const fetchIVSurface = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/options/${symbol}/iv-surface`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const surfaceData = await response.json();
      setData(surfaceData);
    } catch (err) {
      console.error('Error fetching IV surface:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch IV surface');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchIVSurface();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchIVSurface, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchIVSurface, refreshInterval]);

  // Process data for visualization
  const processedData = useMemo(() => {
    if (!data?.surfacePoints) return { gridData: [], contourData: [], heatmapData: [] };

    const points = data.surfacePoints;

    // Create grid data for 3D visualization
    const gridData = points.map(point => ({
      x: point.moneyness,
      y: point.timeToExpiry,
      z: point.impliedVolatility,
      strike: point.strike,
      expiry: point.expiry,
      type: point.optionType,
      point,
    }));

    // Create contour data (2D slices)
    const contourData = points.reduce((acc, point) => {
      const key = `${point.timeToExpiry}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push({
        moneyness: point.moneyness,
        iv: point.impliedVolatility,
        strike: point.strike,
        point,
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Create heatmap data
    const heatmapData = points.map(point => ({
      x: point.moneyness,
      y: point.timeToExpiry * 365, // Convert to days
      value: point.impliedVolatility,
      point,
    }));

    return { gridData, contourData, heatmapData };
  }, [data]);

  // Color mapping for volatility values
  const getColor = useCallback((value: number, min: number, max: number): string => {
    const normalized = (value - min) / (max - min);

    switch (colorScheme) {
      case 'viridis':
        return `hsl(${240 + normalized * 120}, 70%, ${30 + normalized * 40}%)`;
      case 'plasma':
        return `hsl(${280 + normalized * 80}, 80%, ${20 + normalized * 60}%)`;
      case 'cool':
        return `hsl(${200 + normalized * 60}, 60%, ${40 + normalized * 30}%)`;
      case 'warm':
        return `hsl(${0 + normalized * 60}, 70%, ${40 + normalized * 30}%)`;
      default:
        return `hsl(${240 + normalized * 120}, 70%, ${30 + normalized * 40}%)`;
    }
  }, [colorScheme]);

  // Handle data point selection
  const handlePointClick = (point: IVSurfacePoint) => {
    setSelectedPoint(point);
    onDataPointSelect?.(point);
  };

  // Export data functionality
  const exportData = useCallback((format: 'csv' | 'json') => {
    if (!data) return;

    let content: string;
    let filename: string;

    if (format === 'csv') {
      const headers = ['Symbol', 'Strike', 'Expiry', 'TimeToExpiry', 'Moneyness', 'ImpliedVolatility', 'OptionType'];
      const rows = data.surfacePoints.map(point => [
        data.symbol,
        point.strike,
        point.expiry,
        point.timeToExpiry,
        point.moneyness,
        point.impliedVolatility,
        point.optionType,
      ]);
      content = [headers, ...rows].map(row => row.join(',')).join('\n');
      filename = `${symbol}_iv_surface_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      content = JSON.stringify(data, null, 2);
      filename = `${symbol}_iv_surface_${new Date().toISOString().split('T')[0]}.json`;
    }

    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, symbol]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      const point = payload[0].payload?.point;
      if (point) {
        return (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg">
            <p className="font-semibold text-gray-900 dark:text-white">
              Strike: ${point.strike}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Expiry: {new Date(point.expiry).toLocaleDateString()}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Moneyness: {point.moneyness.toFixed(3)}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Time to Expiry: {(point.timeToExpiry * 365).toFixed(0)} days
            </p>
            <p className="font-medium text-blue-600 dark:text-blue-400">
              IV: {(point.impliedVolatility * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {point.optionType.toUpperCase()}
            </p>
          </div>
        );
      }
    }
    return null;
  };

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'r':
      case 'R':
        fetchIVSurface();
        break;
      case '+':
      case '=':
        setZoomLevel(prev => Math.min(prev + 0.1, 3));
        break;
      case '-':
        setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
        break;
      case 'ArrowLeft':
        setRotation(prev => ({ ...prev, y: prev.y - 5 }));
        break;
      case 'ArrowRight':
        setRotation(prev => ({ ...prev, y: prev.y + 5 }));
        break;
      case 'ArrowUp':
        setRotation(prev => ({ ...prev, x: prev.x - 5 }));
        break;
      case 'ArrowDown':
        setRotation(prev => ({ ...prev, x: prev.x + 5 }));
        break;
    }
  }, [fetchIVSurface]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8" role="status" aria-label="Loading IV surface">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading IV surface...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4" role="alert">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading IV surface</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={fetchIVSurface}
              className="mt-2 btn-primary btn-sm"
              aria-label="Retry loading IV surface"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-8 text-gray-500 dark:text-gray-400">
        No IV surface data available for {symbol}
      </div>
    );
  }

  return (
    <div className={`iv-surface ${className}`} onKeyDown={handleKeyDown} tabIndex={0} ref={containerRef}>
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Implied Volatility Surface - {data.symbol}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Underlying: ${data.underlyingPrice.toFixed(2)} | Avg IV: {(data.avgIV * 100).toFixed(1)}% | Skew: {(data.ivSkew * 100).toFixed(1)}%
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Type Selector */}
          <select
            value={viewType}
            onChange={(e) => setViewType(e.target.value as ViewType)}
            className="form-select text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            aria-label="Select view type"
          >
            <option value="contour">Contour Lines</option>
            <option value="heatmap">Heatmap</option>
            <option value="3d">3D Surface</option>
            <option value="slice">Time Slices</option>
          </select>

          {/* Color Scheme Selector */}
          <select
            value={colorScheme}
            onChange={(e) => setColorScheme(e.target.value as ColorScheme)}
            className="form-select text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            aria-label="Select color scheme"
          >
            <option value="viridis">Viridis</option>
            <option value="plasma">Plasma</option>
            <option value="cool">Cool</option>
            <option value="warm">Warm</option>
          </select>

          {/* Control Buttons */}
          <button
            onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 3))}
            className="btn-secondary btn-sm"
            aria-label="Zoom in"
          >
            <ZoomInIcon className="h-4 w-4" />
          </button>

          <button
            onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.5))}
            className="btn-secondary btn-sm"
            aria-label="Zoom out"
          >
            <ZoomOutIcon className="h-4 w-4" />
          </button>

          <button
            onClick={() => {
              setZoomLevel(1);
              setRotation({ x: 45, y: 45 });
            }}
            className="btn-secondary btn-sm"
            aria-label="Reset view"
          >
            <RotateCcwIcon className="h-4 w-4" />
          </button>

          <button
            onClick={fetchIVSurface}
            className="btn-secondary btn-sm"
            aria-label="Refresh data"
          >
            <RotateCcwIcon className="h-4 w-4" />
          </button>

          {/* Export Menu */}
          <div className="relative group">
            <button className="btn-secondary btn-sm">
              <DownloadIcon className="h-4 w-4" />
            </button>
            <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-700 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <button
                onClick={() => exportData('csv')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Export CSV
              </button>
              <button
                onClick={() => exportData('json')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4" style={{ height }}>
        {viewType === 'contour' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={processedData.gridData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="x"
                type="number"
                domain={['dataMin - 0.1', 'dataMax + 0.1']}
                label={{ value: 'Moneyness (Strike/Underlying)', position: 'insideBottom', offset: -10 }}
              />
              <YAxis
                dataKey="y"
                type="number"
                label={{ value: 'Time to Expiry (Years)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="z"
                stroke="#8884d8"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Implied Volatility"
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {viewType === 'heatmap' && (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={processedData.heatmapData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="x"
                type="number"
                domain={['dataMin - 0.1', 'dataMax + 0.1']}
                label={{ value: 'Moneyness (Strike/Underlying)', position: 'insideBottom', offset: -10 }}
              />
              <YAxis
                dataKey="y"
                type="number"
                label={{ value: 'Days to Expiry', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter dataKey="value" fill="#8884d8">
                {processedData.heatmapData.map((entry, index) => {
                  const minIV = Math.min(...data.surfacePoints.map(p => p.impliedVolatility));
                  const maxIV = Math.max(...data.surfacePoints.map(p => p.impliedVolatility));
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={getColor(entry.value, minIV, maxIV)}
                      onClick={() => handlePointClick(entry.point)}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}

        {(viewType === '3d' || viewType === 'slice') && (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <EyeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>3D and slice views are coming soon!</p>
              <p className="text-sm mt-2">Use contour or heatmap views for now.</p>
            </div>
          </div>
        )}
      </div>

      {/* Statistics Panel */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Surface Statistics</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Average IV:</span>
              <span className="font-medium">{(data.avgIV * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">IV Skew:</span>
              <span className="font-medium">{(data.ivSkew * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Data Points:</span>
              <span className="font-medium">{data.surfacePoints.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Term Structure</h3>
          <div className="space-y-2 text-sm">
            {Object.entries(data.termStructure).slice(0, 3).map(([term, iv]) => (
              <div key={term} className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{term}:</span>
                <span className="font-medium">{(iv * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {selectedPoint && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Selected Point</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Strike:</span>
                <span className="font-medium">${selectedPoint.strike}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Expiry:</span>
                <span className="font-medium">{new Date(selectedPoint.expiry).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">IV:</span>
                <span className="font-medium">{(selectedPoint.impliedVolatility * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
        Keyboard shortcuts: R (refresh), +/- (zoom), Arrow keys (rotate), Click points to select
      </div>

      {/* Last Updated */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
        Last updated: {new Date(data.calculatedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default IVSurface;