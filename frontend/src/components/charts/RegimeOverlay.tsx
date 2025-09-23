/**
 * Regime Overlay Component for Charts
 * Displays volatility regimes and anomaly detection overlays with accessibility support
 */

import React, { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RegimeData {
  date: string;
  regime: number;
  regime_name: string;
  confidence: number;
}

interface AnomalyData {
  index: number;
  timestamp: string;
  value: number;
  score: number;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  detector_type: string;
  description: string;
  confidence: number;
}

interface RegimeTransition {
  date: string;
  from_regime: string;
  to_regime: string;
  confidence: number;
}

interface ChartDimensions {
  width: number;
  height: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

interface RegimeOverlayProps {
  regimes: RegimeData[];
  anomalies: AnomalyData[];
  transitions: RegimeTransition[];
  chartDimensions: ChartDimensions;
  xScale: (date: Date) => number;
  yScale: (value: number) => number;
  showRegimeBackground?: boolean;
  showAnomalyMarkers?: boolean;
  showTransitionLines?: boolean;
  showConfidenceBands?: boolean;
  onAnomalyClick?: (anomaly: AnomalyData) => void;
  onRegimeClick?: (regime: RegimeData) => void;
  className?: string;
}

export const RegimeOverlay: React.FC<RegimeOverlayProps> = ({
  regimes,
  anomalies,
  transitions,
  chartDimensions,
  xScale,
  yScale,
  showRegimeBackground = true,
  showAnomalyMarkers = true,
  showTransitionLines = true,
  showConfidenceBands = false,
  onAnomalyClick,
  onRegimeClick,
  className = ''
}) => {
  // Regime color mapping
  const regimeColors = useMemo(() => ({
    0: { bg: '#dcfce7', border: '#16a34a', name: 'Low Volatility' },      // Green
    1: { bg: '#fef3c7', border: '#d97706', name: 'Medium Volatility' },   // Amber
    2: { bg: '#fee2e2', border: '#dc2626', name: 'High Volatility' },     // Red
    3: { bg: '#fdf2f8', border: '#be185d', name: 'Extreme Volatility' }   // Pink
  }), []);

  // Severity color mapping for anomalies
  const severityColors = useMemo(() => ({
    low: '#10b981',      // Green
    moderate: '#f59e0b', // Amber
    high: '#ef4444',     // Red
    critical: '#7c2d12'  // Dark red
  }), []);

  // Generate regime background segments
  const regimeSegments = useMemo(() => {
    if (!showRegimeBackground || regimes.length === 0) return [];

    const segments = [];
    let currentRegime = regimes[0];
    let segmentStart = new Date(currentRegime.date);

    for (let i = 1; i < regimes.length; i++) {
      const regime = regimes[i];
      const regimeDate = new Date(regime.date);

      if (regime.regime !== currentRegime.regime) {
        // End current segment
        segments.push({
          regime: currentRegime.regime,
          regime_name: currentRegime.regime_name,
          startX: xScale(segmentStart),
          endX: xScale(regimeDate),
          confidence: currentRegime.confidence
        });

        // Start new segment
        currentRegime = regime;
        segmentStart = regimeDate;
      }
    }

    // Add final segment
    if (regimes.length > 0) {
      const lastDate = new Date(regimes[regimes.length - 1].date);
      segments.push({
        regime: currentRegime.regime,
        regime_name: currentRegime.regime_name,
        startX: xScale(segmentStart),
        endX: xScale(lastDate),
        confidence: currentRegime.confidence
      });
    }

    return segments;
  }, [regimes, xScale, showRegimeBackground]);

  // Generate anomaly markers
  const anomalyMarkers = useMemo(() => {
    if (!showAnomalyMarkers) return [];

    return anomalies.map(anomaly => {
      const x = xScale(new Date(anomaly.timestamp));
      const y = yScale(anomaly.value);

      return {
        ...anomaly,
        x,
        y,
        color: severityColors[anomaly.severity],
        size: anomaly.severity === 'critical' ? 12 :
              anomaly.severity === 'high' ? 10 :
              anomaly.severity === 'moderate' ? 8 : 6
      };
    });
  }, [anomalies, xScale, yScale, showAnomalyMarkers, severityColors]);

  // Generate transition lines
  const transitionLines = useMemo(() => {
    if (!showTransitionLines) return [];

    return transitions.map(transition => ({
      ...transition,
      x: xScale(new Date(transition.date))
    }));
  }, [transitions, xScale, showTransitionLines]);

  const handleAnomalyClick = useCallback((anomaly: AnomalyData) => {
    onAnomalyClick?.(anomaly);
  }, [onAnomalyClick]);

  const handleRegimeClick = useCallback((regime: RegimeData) => {
    onRegimeClick?.(regime);
  }, [onRegimeClick]);

  return (
    <div
      className={`regime-overlay absolute inset-0 pointer-events-none ${className}`}
      role="img"
      aria-label="Volatility regime and anomaly detection overlay"
    >
      <svg
        width={chartDimensions.width}
        height={chartDimensions.height}
        className="absolute inset-0"
        aria-hidden="true"
      >
        {/* Regime Background Segments */}
        {showRegimeBackground && (
          <g role="group" aria-label="Volatility regime backgrounds">
            {regimeSegments.map((segment, index) => {
              const colors = regimeColors[segment.regime as keyof typeof regimeColors];
              const opacity = showConfidenceBands ? segment.confidence * 0.4 : 0.2;

              return (
                <rect
                  key={`regime-bg-${index}`}
                  x={segment.startX}
                  y={chartDimensions.marginTop}
                  width={segment.endX - segment.startX}
                  height={chartDimensions.height - chartDimensions.marginTop - chartDimensions.marginBottom}
                  fill={colors.bg}
                  fillOpacity={opacity}
                  stroke={colors.border}
                  strokeWidth={0.5}
                  strokeOpacity={0.3}
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => handleRegimeClick({
                    date: '',
                    regime: segment.regime,
                    regime_name: segment.regime_name,
                    confidence: segment.confidence
                  })}
                />
              );
            })}
          </g>
        )}

        {/* Transition Lines */}
        {showTransitionLines && (
          <g role="group" aria-label="Regime transition markers">
            {transitionLines.map((transition, index) => (
              <g key={`transition-${index}`}>
                <line
                  x1={transition.x}
                  y1={chartDimensions.marginTop}
                  x2={transition.x}
                  y2={chartDimensions.height - chartDimensions.marginBottom}
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="5,5"
                  opacity={0.7}
                />
                <circle
                  cx={transition.x}
                  cy={chartDimensions.marginTop + 10}
                  r={4}
                  fill="#6b7280"
                  opacity={0.8}
                />
              </g>
            ))}
          </g>
        )}

        {/* Anomaly Markers */}
        {showAnomalyMarkers && (
          <g role="group" aria-label="Anomaly detection markers">
            {anomalyMarkers.map((anomaly, index) => (
              <g key={`anomaly-${index}`}>
                {/* Anomaly pulse effect for critical anomalies */}
                {anomaly.severity === 'critical' && (
                  <circle
                    cx={anomaly.x}
                    cy={anomaly.y}
                    r={anomaly.size + 4}
                    fill={anomaly.color}
                    opacity={0.3}
                    className="animate-ping"
                  />
                )}

                {/* Main anomaly marker */}
                <circle
                  cx={anomaly.x}
                  cy={anomaly.y}
                  r={anomaly.size}
                  fill={anomaly.color}
                  stroke="#ffffff"
                  strokeWidth={2}
                  opacity={0.9}
                  className="pointer-events-auto cursor-pointer hover:opacity-100 transition-opacity"
                  onClick={() => handleAnomalyClick(anomaly)}
                />

                {/* Anomaly severity indicator */}
                <circle
                  cx={anomaly.x}
                  cy={anomaly.y}
                  r={anomaly.size / 2}
                  fill="#ffffff"
                  opacity={0.8}
                />
              </g>
            ))}
          </g>
        )}
      </svg>

      {/* Regime Legend */}
      <RegimeLegend
        regimeColors={regimeColors}
        currentRegimes={regimeSegments}
        showConfidenceBands={showConfidenceBands}
      />

      {/* Anomaly Count Badge */}
      {anomalies.length > 0 && (
        <AnomalyBadge
          anomalies={anomalies}
          severityColors={severityColors}
        />
      )}
    </div>
  );
};

/**
 * Regime Legend Component
 */
interface RegimeLegendProps {
  regimeColors: Record<number, { bg: string; border: string; name: string }>;
  currentRegimes: Array<{ regime: number; confidence: number }>;
  showConfidenceBands: boolean;
}

const RegimeLegend: React.FC<RegimeLegendProps> = ({
  regimeColors,
  currentRegimes,
  showConfidenceBands
}) => {
  const activeRegimes = useMemo(() => {
    const regimeSet = new Set(currentRegimes.map(r => r.regime));
    return Array.from(regimeSet).sort();
  }, [currentRegimes]);

  return (
    <div
      className="absolute top-2 left-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 pointer-events-auto z-10"
      role="group"
      aria-label="Volatility regime legend"
    >
      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Volatility Regimes
      </h4>
      <div className="space-y-1">
        {activeRegimes.map(regime => {
          const colors = regimeColors[regime];
          const avgConfidence = currentRegimes
            .filter(r => r.regime === regime)
            .reduce((sum, r) => sum + r.confidence, 0) /
            currentRegimes.filter(r => r.regime === regime).length;

          return (
            <div key={regime} className="flex items-center space-x-2 text-xs">
              <div
                className="w-3 h-3 rounded border"
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  opacity: showConfidenceBands ? avgConfidence : 1
                }}
                aria-hidden="true"
              />
              <span className="text-gray-700 dark:text-gray-300">
                {colors.name}
              </span>
              {showConfidenceBands && (
                <span className="text-gray-500 text-xs">
                  ({(avgConfidence * 100).toFixed(0)}%)
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Anomaly Count Badge Component
 */
interface AnomalyBadgeProps {
  anomalies: AnomalyData[];
  severityColors: Record<string, string>;
}

const AnomalyBadge: React.FC<AnomalyBadgeProps> = ({
  anomalies,
  severityColors
}) => {
  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, moderate: 0, low: 0 };
    anomalies.forEach(anomaly => {
      counts[anomaly.severity]++;
    });
    return counts;
  }, [anomalies]);

  const hasHighSeverity = severityCounts.critical > 0 || severityCounts.high > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-2 right-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 pointer-events-auto z-10"
      role="group"
      aria-label="Anomaly detection summary"
    >
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${hasHighSeverity ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {anomalies.length} Anomalies
        </span>
      </div>

      {hasHighSeverity && (
        <div className="mt-1 space-y-1">
          {severityCounts.critical > 0 && (
            <div className="flex items-center space-x-1 text-xs">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: severityColors.critical }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {severityCounts.critical} Critical
              </span>
            </div>
          )}
          {severityCounts.high > 0 && (
            <div className="flex items-center space-x-1 text-xs">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: severityColors.high }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {severityCounts.high} High
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

/**
 * Anomaly Tooltip Component
 */
interface AnomalyTooltipProps {
  anomaly: AnomalyData | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export const AnomalyTooltip: React.FC<AnomalyTooltipProps> = ({
  anomaly,
  position,
  onClose
}) => {
  if (!anomaly || !position) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-xs"
        style={{
          left: position.x + 10,
          top: position.y - 10,
          transform: 'translateY(-100%)'
        }}
        role="tooltip"
        aria-live="polite"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center"
          aria-label="Close anomaly details"
        >
          <span className="text-xs text-gray-500 dark:text-gray-400">×</span>
        </button>

        {/* Anomaly details */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full`}
              style={{
                backgroundColor: anomaly.severity === 'critical' ? '#7c2d12' :
                                anomaly.severity === 'high' ? '#ef4444' :
                                anomaly.severity === 'moderate' ? '#f59e0b' : '#10b981'
              }}
            />
            <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
              {anomaly.severity} Anomaly
            </span>
          </div>

          <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <div>
              <span className="font-medium">Detector:</span> {anomaly.detector_type}
            </div>
            <div>
              <span className="font-medium">Score:</span> {anomaly.score.toFixed(3)}
            </div>
            <div>
              <span className="font-medium">Confidence:</span> {(anomaly.confidence * 100).toFixed(1)}%
            </div>
            <div>
              <span className="font-medium">Time:</span> {new Date(anomaly.timestamp).toLocaleString()}
            </div>
          </div>

          <div className="text-xs text-gray-700 dark:text-gray-200 mt-2">
            {anomaly.description}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Regime Transition Tooltip Component
 */
interface RegimeTooltipProps {
  regime: RegimeData | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export const RegimeTooltip: React.FC<RegimeTooltipProps> = ({
  regime,
  position,
  onClose
}) => {
  if (!regime || !position) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-xs"
        style={{
          left: position.x + 10,
          top: position.y - 10,
          transform: 'translateY(-100%)'
        }}
        role="tooltip"
        aria-live="polite"
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center"
          aria-label="Close regime details"
        >
          <span className="text-xs text-gray-500 dark:text-gray-400">×</span>
        </button>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {regime.regime_name}
          </div>

          <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <div>
              <span className="font-medium">Confidence:</span> {(regime.confidence * 100).toFixed(1)}%
            </div>
            <div>
              <span className="font-medium">Regime ID:</span> {regime.regime}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RegimeOverlay;