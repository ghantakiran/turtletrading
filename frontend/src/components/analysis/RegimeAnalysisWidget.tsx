/**
 * Regime Analysis Widget
 * Comprehensive volatility regime and anomaly analysis with accessible UI
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RegimeOverlay, AnomalyTooltip, RegimeTooltip } from '../charts/RegimeOverlay';

interface RegimeAnalysisData {
  symbol: string;
  analysis_date: string;
  regime_analysis: {
    symbol: string;
    regimes: Array<{
      date: string;
      regime: number;
      regime_name: string;
      confidence: number;
    }>;
    transitions: Array<{
      date: string;
      from_regime: string;
      to_regime: string;
      confidence: number;
    }>;
    confidence: number;
    metadata: {
      lookback_days: number;
      n_regimes: number;
      regime_descriptions: Array<{
        id: number;
        name: string;
        description: string;
      }>;
    };
  };
  anomaly_detection: Array<{
    index: number;
    timestamp: string;
    value: number;
    score: number;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    detector_type: string;
    description: string;
    confidence: number;
  }>;
  current_regime: {
    regime: string;
    regime_id: number;
    confidence: number;
    timestamp: string;
  };
  insights: string[];
  risk_assessment: {
    risk_level: string;
    risk_score: number;
    risk_factors: string[];
    recommendation: string;
  };
}

interface RegimeAnalysisWidgetProps {
  symbol: string;
  lookbackDays?: number;
  onRegimeChange?: (regime: any) => void;
  onAnomalyDetected?: (anomaly: any) => void;
  className?: string;
  height?: number;
}

export const RegimeAnalysisWidget: React.FC<RegimeAnalysisWidgetProps> = ({
  symbol,
  lookbackDays = 100,
  onRegimeChange,
  onAnomalyDetected,
  className = '',
  height = 400
}) => {
  const [data, setData] = useState<RegimeAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'regimes' | 'anomalies' | 'insights'>('overview');
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [selectedRegime, setSelectedRegime] = useState<any>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  // Chart dimensions
  const chartDimensions = useMemo(() => ({
    width: 600,
    height: height - 100,
    marginTop: 20,
    marginBottom: 40,
    marginLeft: 60,
    marginRight: 20
  }), [height]);

  // Mock scales for demo (in real implementation, these would come from your chart library)
  const xScale = useCallback((date: Date) => {
    // Mock scale that maps dates to x coordinates
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const endDate = new Date();
    const ratio = (date.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime());
    return chartDimensions.marginLeft + ratio * (chartDimensions.width - chartDimensions.marginLeft - chartDimensions.marginRight);
  }, [lookbackDays, chartDimensions]);

  const yScale = useCallback((value: number) => {
    // Mock scale that maps values to y coordinates
    return chartDimensions.marginTop + (chartDimensions.height - chartDimensions.marginTop - chartDimensions.marginBottom) * 0.5;
  }, [chartDimensions]);

  /**
   * Fetch regime analysis data
   */
  const fetchAnalysisData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/regimes/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          symbol,
          lookback_days: lookbackDays,
          n_regimes: 3
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analysis: ${response.status}`);
      }

      const analysisData = await response.json();
      setData(analysisData);

      // Notify parent components
      onRegimeChange?.(analysisData.current_regime);
      if (analysisData.anomaly_detection.length > 0) {
        onAnomalyDetected?.(analysisData.anomaly_detection[0]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [symbol, lookbackDays, onRegimeChange, onAnomalyDetected]);

  // Fetch data on mount and symbol change
  useEffect(() => {
    fetchAnalysisData();
  }, [fetchAnalysisData]);

  /**
   * Handle anomaly click
   */
  const handleAnomalyClick = useCallback((anomaly: any, event?: MouseEvent) => {
    setSelectedAnomaly(anomaly);
    if (event) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  }, []);

  /**
   * Handle regime click
   */
  const handleRegimeClick = useCallback((regime: any, event?: MouseEvent) => {
    setSelectedRegime(regime);
    if (event) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  }, []);

  /**
   * Close tooltips
   */
  const closeTooltips = useCallback(() => {
    setSelectedAnomaly(null);
    setSelectedRegime(null);
    setTooltipPosition(null);
  }, []);

  /**
   * Get risk level color
   */
  const getRiskLevelColor = useCallback((riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'very high': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-red-500 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-500 bg-green-50 border-green-200';
      case 'very low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }, []);

  if (loading) {
    return (
      <div className={`regime-analysis-widget ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            <span className="text-gray-600 dark:text-gray-400">Analyzing volatility regimes...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`regime-analysis-widget ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <div className="text-red-500 font-medium">Analysis Error</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{error}</div>
            <button
              onClick={fetchAnalysisData}
              className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
            >
              Retry Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`regime-analysis-widget bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`} style={{ height }}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Regime Analysis: {symbol}
            </h3>
            <div className="flex items-center space-x-4 mt-1">
              <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getRiskLevelColor(data.risk_assessment.risk_level)}`}>
                Risk: {data.risk_assessment.risk_level}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Current: {data.current_regime.regime} ({(data.current_regime.confidence * 100).toFixed(1)}% confidence)
              </div>
            </div>
          </div>
          <button
            onClick={fetchAnalysisData}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Refresh analysis"
          >
            <RefreshIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'regimes', label: 'Regimes' },
          { id: 'anomalies', label: `Anomalies (${data.anomaly_detection.length})` },
          { id: 'insights', label: 'Insights' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === tab.id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            role="tab"
            aria-selected={selectedTab === tab.id}
            aria-controls={`panel-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 overflow-auto" style={{ height: height - 140 }}>
        <AnimatePresence mode="wait">
          {selectedTab === 'overview' && (
            <OverviewPanel
              key="overview"
              data={data}
              onAnomalyClick={handleAnomalyClick}
              onRegimeClick={handleRegimeClick}
            />
          )}

          {selectedTab === 'regimes' && (
            <RegimePanel
              key="regimes"
              regimeAnalysis={data.regime_analysis}
              currentRegime={data.current_regime}
            />
          )}

          {selectedTab === 'anomalies' && (
            <AnomalyPanel
              key="anomalies"
              anomalies={data.anomaly_detection}
              onAnomalyClick={handleAnomalyClick}
            />
          )}

          {selectedTab === 'insights' && (
            <InsightsPanel
              key="insights"
              insights={data.insights}
              riskAssessment={data.risk_assessment}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Chart Overlay (for overview tab) */}
      {selectedTab === 'overview' && data && (
        <div className="relative">
          <RegimeOverlay
            regimes={data.regime_analysis.regimes}
            anomalies={data.anomaly_detection}
            transitions={data.regime_analysis.transitions}
            chartDimensions={chartDimensions}
            xScale={xScale}
            yScale={yScale}
            onAnomalyClick={handleAnomalyClick}
            onRegimeClick={handleRegimeClick}
            showRegimeBackground={true}
            showAnomalyMarkers={true}
            showTransitionLines={true}
            showConfidenceBands={false}
          />
        </div>
      )}

      {/* Tooltips */}
      <AnomalyTooltip
        anomaly={selectedAnomaly}
        position={tooltipPosition}
        onClose={closeTooltips}
      />

      <RegimeTooltip
        regime={selectedRegime}
        position={tooltipPosition}
        onClose={closeTooltips}
      />
    </div>
  );
};

/**
 * Overview Panel Component
 */
const OverviewPanel: React.FC<{
  data: RegimeAnalysisData;
  onAnomalyClick: (anomaly: any) => void;
  onRegimeClick: (regime: any) => void;
}> = ({ data, onAnomalyClick, onRegimeClick }) => {
  const criticalAnomalies = data.anomaly_detection.filter(a => a.severity === 'critical').length;
  const highAnomalies = data.anomaly_detection.filter(a => a.severity === 'high').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">Current Regime</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {data.current_regime.regime}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">Confidence</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {(data.current_regime.confidence * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">Anomalies</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {data.anomaly_detection.length}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">Transitions</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {data.regime_analysis.transitions.length}
          </div>
        </div>
      </div>

      {/* Recent Anomalies */}
      {(criticalAnomalies > 0 || highAnomalies > 0) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-400 mb-2">
            High-Severity Anomalies Detected
          </h4>
          <div className="text-sm text-red-700 dark:text-red-300 space-y-1">
            {criticalAnomalies > 0 && (
              <div>• {criticalAnomalies} critical anomalies requiring immediate attention</div>
            )}
            {highAnomalies > 0 && (
              <div>• {highAnomalies} high-severity anomalies detected</div>
            )}
          </div>
        </div>
      )}

      {/* Quick Insights */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Key Insights</h4>
        {data.insights.slice(0, 3).map((insight, index) => (
          <div key={index} className="flex items-start space-x-2">
            <div className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
            <span className="text-sm text-gray-600 dark:text-gray-300">{insight}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

/**
 * Regime Panel Component
 */
const RegimePanel: React.FC<{
  regimeAnalysis: RegimeAnalysisData['regime_analysis'];
  currentRegime: RegimeAnalysisData['current_regime'];
}> = ({ regimeAnalysis, currentRegime }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Current Regime */}
      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-primary-800 dark:text-primary-400 mb-2">
          Current Volatility Regime
        </h4>
        <div className="text-lg font-semibold text-primary-900 dark:text-primary-300">
          {currentRegime.regime}
        </div>
        <div className="text-sm text-primary-700 dark:text-primary-400 mt-1">
          Confidence: {(currentRegime.confidence * 100).toFixed(1)}% •
          Updated: {new Date(currentRegime.timestamp).toLocaleString()}
        </div>
      </div>

      {/* Regime Descriptions */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Regime Types</h4>
        {regimeAnalysis.metadata.regime_descriptions.map(regime => (
          <div key={regime.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="font-medium text-gray-900 dark:text-white">{regime.name}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{regime.description}</div>
          </div>
        ))}
      </div>

      {/* Recent Transitions */}
      {regimeAnalysis.transitions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Recent Transitions</h4>
          {regimeAnalysis.transitions.slice(-5).map((transition, index) => (
            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-900 dark:text-white">
                  {transition.from_regime} → {transition.to_regime}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(transition.date).toLocaleDateString()}
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Confidence: {(transition.confidence * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

/**
 * Anomaly Panel Component
 */
const AnomalyPanel: React.FC<{
  anomalies: RegimeAnalysisData['anomaly_detection'];
  onAnomalyClick: (anomaly: any) => void;
}> = ({ anomalies, onAnomalyClick }) => {
  const groupedAnomalies = useMemo(() => {
    const grouped: Record<string, typeof anomalies> = {};
    anomalies.forEach(anomaly => {
      if (!grouped[anomaly.severity]) {
        grouped[anomaly.severity] = [];
      }
      grouped[anomaly.severity].push(anomaly);
    });
    return grouped;
  }, [anomalies]);

  const severityOrder = ['critical', 'high', 'moderate', 'low'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {severityOrder.map(severity => {
        const severityAnomalies = groupedAnomalies[severity];
        if (!severityAnomalies || severityAnomalies.length === 0) return null;

        return (
          <div key={severity} className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
              {severity} Severity ({severityAnomalies.length})
            </h4>
            {severityAnomalies.map((anomaly, index) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => onAnomalyClick(anomaly)}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {anomaly.detector_type} Detection
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Score: {anomaly.score.toFixed(3)}
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {anomaly.description}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {new Date(anomaly.timestamp).toLocaleString()} •
                  Confidence: {(anomaly.confidence * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {anomalies.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No anomalies detected in the analysis period
        </div>
      )}
    </motion.div>
  );
};

/**
 * Insights Panel Component
 */
const InsightsPanel: React.FC<{
  insights: string[];
  riskAssessment: RegimeAnalysisData['risk_assessment'];
}> = ({ insights, riskAssessment }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Risk Assessment */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Risk Assessment</h4>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-900 dark:text-white">Overall Risk Level</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              riskAssessment.risk_level === 'Very High' ? 'bg-red-100 text-red-800' :
              riskAssessment.risk_level === 'High' ? 'bg-red-100 text-red-800' :
              riskAssessment.risk_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {riskAssessment.risk_level}
            </span>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            {riskAssessment.recommendation}
          </div>
          {riskAssessment.risk_factors.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Risk Factors:</div>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {riskAssessment.risk_factors.map((factor, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Insights */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Analysis Insights</h4>
        {insights.map((insight, index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <div className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
              <span className="text-sm text-gray-600 dark:text-gray-300">{insight}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// Icons
const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export default RegimeAnalysisWidget;