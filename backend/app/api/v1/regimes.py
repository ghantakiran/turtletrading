"""
API endpoints for anomaly detection and volatility regime analysis
Provides regime timeline, anomaly detection, and confidence scoring
"""

from fastapi import APIRouter, HTTPException, Query, Depends, Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
import logging

from app.services.anomaly_detection import (
    AnomalyDetectionService,
    AnomalyResult,
    AnomalySeverity,
    VolatilityRegime
)
from app.core.auth import get_current_user
from app.models.auth_schemas import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/regimes", tags=["regimes"])

# Pydantic models for API responses
class AnomalyResponse(BaseModel):
    """Anomaly detection response model"""
    index: int = Field(..., description="Index in the time series")
    timestamp: datetime = Field(..., description="Timestamp of the anomaly")
    value: float = Field(..., description="Value at the anomaly point")
    score: float = Field(..., description="Anomaly score")
    severity: AnomalySeverity = Field(..., description="Anomaly severity level")
    detector_type: str = Field(..., description="Type of detector that found the anomaly")
    description: str = Field(..., description="Human-readable description")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score")


class RegimeTimelineResponse(BaseModel):
    """Regime timeline response model"""
    symbol: str = Field(..., description="Stock symbol")
    regimes: List[Dict[str, Any]] = Field(..., description="Regime timeline data")
    transitions: List[Dict[str, Any]] = Field(..., description="Regime transitions")
    confidence: float = Field(..., ge=0, le=1, description="Overall confidence")
    metadata: Dict[str, Any] = Field(..., description="Analysis metadata")


class CurrentRegimeResponse(BaseModel):
    """Current regime response model"""
    regime: str = Field(..., description="Current regime name")
    regime_id: int = Field(..., description="Current regime ID")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score")
    timestamp: str = Field(..., description="Analysis timestamp")


class AnomalyDetectionRequest(BaseModel):
    """Anomaly detection request model"""
    symbol: str = Field(..., min_length=1, max_length=10, description="Stock symbol")
    lookback_days: int = Field(100, ge=30, le=1000, description="Days to look back")
    enable_zscore: bool = Field(True, description="Enable z-score detection")
    enable_ewma: bool = Field(True, description="Enable EWMA detection")
    enable_garch: bool = Field(True, description="Enable GARCH detection")
    enable_isolation_forest: bool = Field(True, description="Enable Isolation Forest detection")


class RegimeAnalysisRequest(BaseModel):
    """Regime analysis request model"""
    symbol: str = Field(..., min_length=1, max_length=10, description="Stock symbol")
    lookback_days: int = Field(100, ge=30, le=1000, description="Days to look back")
    n_regimes: int = Field(3, ge=2, le=5, description="Number of regimes to identify")


# Global service instance (will be initialized on startup)
anomaly_service: Optional[AnomalyDetectionService] = None


def get_anomaly_service() -> AnomalyDetectionService:
    """Get anomaly detection service instance"""
    global anomaly_service
    if anomaly_service is None:
        anomaly_service = AnomalyDetectionService(random_seed=42)
    return anomaly_service


@router.get(
    "/{symbol}/timeline",
    response_model=RegimeTimelineResponse,
    summary="Get regime timeline for a symbol",
    description="Returns volatility regime timeline with transitions and confidence scores"
)
async def get_regime_timeline(
    symbol: str = Path(..., description="Stock symbol (e.g., AAPL, MSFT)"),
    window: int = Query(100, ge=30, le=1000, description="Analysis window in days"),
    current_user: User = Depends(get_current_user),
    service: AnomalyDetectionService = Depends(get_anomaly_service)
):
    """
    Get volatility regime timeline for a stock symbol.

    Returns a timeline of volatility regimes with:
    - Regime classifications (Low, Medium, High volatility)
    - Transition points between regimes
    - Confidence scores for each classification
    - Metadata about the analysis
    """
    try:
        # Validate symbol format
        symbol = symbol.upper().strip()
        if not symbol.replace('.', '').replace('-', '').isalnum():
            raise HTTPException(status_code=400, detail="Invalid symbol format")

        # Get regime timeline
        timeline = await service.get_regime_timeline(symbol, lookback_days=window)

        return RegimeTimelineResponse(**timeline)

    except ValueError as e:
        logger.warning(f"Regime timeline request failed for {symbol}: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in regime timeline: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/{symbol}/current",
    response_model=CurrentRegimeResponse,
    summary="Get current regime for a symbol",
    description="Returns the current volatility regime classification"
)
async def get_current_regime(
    symbol: str = Path(..., description="Stock symbol (e.g., AAPL, MSFT)"),
    current_user: User = Depends(get_current_user),
    service: AnomalyDetectionService = Depends(get_anomaly_service)
):
    """
    Get the current volatility regime for a stock symbol.

    Returns:
    - Current regime classification
    - Confidence score
    - Analysis timestamp
    """
    try:
        symbol = symbol.upper().strip()
        if not symbol.replace('.', '').replace('-', '').isalnum():
            raise HTTPException(status_code=400, detail="Invalid symbol format")

        regime_info = await service.get_current_regime(symbol)

        return CurrentRegimeResponse(**regime_info)

    except ValueError as e:
        logger.warning(f"Current regime request failed for {symbol}: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in current regime: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/{symbol}/anomalies",
    response_model=List[AnomalyResponse],
    summary="Detect anomalies in stock data",
    description="Detect anomalies using multiple detection methods"
)
async def detect_anomalies(
    symbol: str = Path(..., description="Stock symbol (e.g., AAPL, MSFT)"),
    lookback_days: int = Query(100, ge=30, le=1000, description="Days to analyze"),
    enable_zscore: bool = Query(True, description="Enable z-score detection"),
    enable_ewma: bool = Query(True, description="Enable EWMA detection"),
    enable_garch: bool = Query(True, description="Enable GARCH detection"),
    enable_isolation_forest: bool = Query(True, description="Enable Isolation Forest"),
    min_severity: str = Query("low", description="Minimum severity level"),
    current_user: User = Depends(get_current_user)
):
    """
    Detect anomalies in stock price and volume data.

    Uses multiple detection methods:
    - Z-score: Detects statistical outliers in returns
    - EWMA: Detects deviations from exponential moving average
    - GARCH: Detects volatility anomalies using GARCH modeling
    - Isolation Forest: Detects multivariate anomalies

    Returns anomalies sorted by severity and confidence.
    """
    try:
        symbol = symbol.upper().strip()
        if not symbol.replace('.', '').replace('-', '').isalnum():
            raise HTTPException(status_code=400, detail="Invalid symbol format")

        # Validate severity level
        valid_severities = ["low", "moderate", "high", "critical"]
        if min_severity not in valid_severities:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid severity level. Must be one of: {valid_severities}"
            )

        # Create service with specified detectors
        service = AnomalyDetectionService(
            enable_zscore=enable_zscore,
            enable_ewma=enable_ewma,
            enable_garch=enable_garch,
            enable_isolation_forest=enable_isolation_forest,
            random_seed=42
        )

        # Detect anomalies
        anomalies = await service.detect_anomalies(symbol, lookback_days=lookback_days)

        # Filter by minimum severity
        severity_order = {"low": 0, "moderate": 1, "high": 2, "critical": 3}
        min_severity_level = severity_order[min_severity]

        filtered_anomalies = [
            a for a in anomalies
            if severity_order[a.severity.value] >= min_severity_level
        ]

        # Convert to response models
        response_anomalies = []
        for anomaly in filtered_anomalies:
            response_anomalies.append(AnomalyResponse(
                index=anomaly.index,
                timestamp=anomaly.timestamp,
                value=anomaly.value,
                score=anomaly.score,
                severity=anomaly.severity,
                detector_type=anomaly.detector_type,
                description=anomaly.description,
                confidence=anomaly.confidence
            ))

        return response_anomalies

    except ValueError as e:
        logger.warning(f"Anomaly detection failed for {symbol}: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in anomaly detection: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/analyze",
    response_model=Dict[str, Any],
    summary="Comprehensive regime and anomaly analysis",
    description="Perform comprehensive analysis including regimes, anomalies, and insights"
)
async def comprehensive_analysis(
    request: RegimeAnalysisRequest,
    current_user: User = Depends(get_current_user),
    service: AnomalyDetectionService = Depends(get_anomaly_service)
):
    """
    Perform comprehensive volatility regime and anomaly analysis.

    Returns:
    - Regime timeline and transitions
    - Detected anomalies across all methods
    - Analysis insights and recommendations
    - Risk assessment based on current regime
    """
    try:
        symbol = request.symbol.upper().strip()
        if not symbol.replace('.', '').replace('-', '').isalnum():
            raise HTTPException(status_code=400, detail="Invalid symbol format")

        # Get regime timeline
        regime_timeline = await service.get_regime_timeline(
            symbol,
            lookback_days=request.lookback_days
        )

        # Detect anomalies
        anomalies = await service.detect_anomalies(
            symbol,
            lookback_days=request.lookback_days
        )

        # Get current regime
        current_regime = await service.get_current_regime(symbol)

        # Generate insights
        insights = _generate_analysis_insights(regime_timeline, anomalies, current_regime)

        return {
            "symbol": symbol,
            "analysis_date": datetime.now().isoformat(),
            "regime_analysis": regime_timeline,
            "anomaly_detection": [
                {
                    "index": a.index,
                    "timestamp": a.timestamp.isoformat(),
                    "value": a.value,
                    "score": a.score,
                    "severity": a.severity.value,
                    "detector_type": a.detector_type,
                    "description": a.description,
                    "confidence": a.confidence
                }
                for a in anomalies[:20]  # Limit to top 20 anomalies
            ],
            "current_regime": current_regime,
            "insights": insights,
            "risk_assessment": _assess_risk_level(regime_timeline, anomalies, current_regime)
        }

    except ValueError as e:
        logger.warning(f"Comprehensive analysis failed for {request.symbol}: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in comprehensive analysis: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/health",
    summary="Health check for regime detection service",
    description="Check if anomaly detection and regime classification services are operational"
)
async def health_check():
    """
    Health check endpoint for the regime detection service.

    Returns service status and version information.
    """
    try:
        # Test service initialization
        test_service = AnomalyDetectionService(random_seed=42)

        return {
            "status": "healthy",
            "service": "anomaly_detection",
            "version": "1.0.0",
            "features": {
                "zscore_detection": True,
                "ewma_detection": True,
                "garch_modeling": True,
                "isolation_forest": True,
                "regime_classification": True
            },
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


def _generate_analysis_insights(
    regime_timeline: Dict[str, Any],
    anomalies: List[AnomalyResult],
    current_regime: Dict[str, Any]
) -> List[str]:
    """Generate analysis insights based on regime and anomaly data"""
    insights = []

    # Regime-based insights
    regime_confidence = regime_timeline.get('confidence', 0)
    if regime_confidence > 0.8:
        insights.append("High confidence in regime classification")
    elif regime_confidence < 0.5:
        insights.append("Low confidence in regime classification - market may be transitioning")

    # Recent transitions
    transitions = regime_timeline.get('transitions', [])
    recent_transitions = [
        t for t in transitions
        if datetime.fromisoformat(t['date']) > datetime.now() - timedelta(days=30)
    ]

    if len(recent_transitions) > 2:
        insights.append("Multiple regime changes in the past 30 days indicate increased market volatility")
    elif len(recent_transitions) == 0:
        insights.append("Stable regime with no recent transitions")

    # Anomaly-based insights
    high_severity_anomalies = [
        a for a in anomalies
        if a.severity in [AnomalySeverity.HIGH, AnomalySeverity.CRITICAL]
    ]

    if len(high_severity_anomalies) > 5:
        insights.append("Multiple high-severity anomalies detected - increased risk")
    elif len(anomalies) == 0:
        insights.append("No significant anomalies detected in the analysis period")

    # Current regime insights
    current_regime_name = current_regime.get('regime', 'unknown')
    if current_regime_name == "High Volatility":
        insights.append("Currently in high volatility regime - expect increased price swings")
    elif current_regime_name == "Low Volatility":
        insights.append("Currently in low volatility regime - relatively stable conditions")

    return insights


def _assess_risk_level(
    regime_timeline: Dict[str, Any],
    anomalies: List[AnomalyResult],
    current_regime: Dict[str, Any]
) -> Dict[str, Any]:
    """Assess overall risk level based on analysis results"""

    # Start with neutral risk
    risk_score = 0.5
    risk_factors = []

    # Current regime risk
    current_regime_name = current_regime.get('regime', 'unknown')
    regime_confidence = current_regime.get('confidence', 0)

    if current_regime_name == "High Volatility":
        risk_score += 0.2
        risk_factors.append("High volatility regime")
    elif current_regime_name == "Extreme Volatility":
        risk_score += 0.3
        risk_factors.append("Extreme volatility regime")

    if regime_confidence < 0.5:
        risk_score += 0.1
        risk_factors.append("Low regime classification confidence")

    # Anomaly-based risk
    critical_anomalies = len([a for a in anomalies if a.severity == AnomalySeverity.CRITICAL])
    high_anomalies = len([a for a in anomalies if a.severity == AnomalySeverity.HIGH])

    if critical_anomalies > 0:
        risk_score += 0.2
        risk_factors.append(f"{critical_anomalies} critical anomalies detected")

    if high_anomalies > 3:
        risk_score += 0.1
        risk_factors.append(f"{high_anomalies} high-severity anomalies")

    # Recent transitions
    transitions = regime_timeline.get('transitions', [])
    recent_transitions = len([
        t for t in transitions
        if datetime.fromisoformat(t['date']) > datetime.now() - timedelta(days=14)
    ])

    if recent_transitions > 1:
        risk_score += 0.1
        risk_factors.append("Multiple recent regime transitions")

    # Cap risk score
    risk_score = min(risk_score, 1.0)

    # Determine risk level
    if risk_score >= 0.8:
        risk_level = "Very High"
    elif risk_score >= 0.65:
        risk_level = "High"
    elif risk_score >= 0.45:
        risk_level = "Medium"
    elif risk_score >= 0.3:
        risk_level = "Low"
    else:
        risk_level = "Very Low"

    return {
        "risk_level": risk_level,
        "risk_score": round(risk_score, 2),
        "risk_factors": risk_factors,
        "recommendation": _get_risk_recommendation(risk_level)
    }


def _get_risk_recommendation(risk_level: str) -> str:
    """Get recommendation based on risk level"""
    recommendations = {
        "Very High": "Exercise extreme caution. Consider reducing position sizes and increasing diversification.",
        "High": "Elevated risk detected. Consider defensive positioning and closer monitoring.",
        "Medium": "Moderate risk environment. Maintain standard risk management practices.",
        "Low": "Low risk environment. Normal trading strategies appropriate.",
        "Very Low": "Stable conditions. Consider opportunities for strategic positioning."
    }

    return recommendations.get(risk_level, "Monitor conditions carefully.")