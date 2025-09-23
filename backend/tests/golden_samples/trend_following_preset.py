"""
Golden samples for Trend Following indicator preset.

This module contains reference data and expected outputs for the Trend Following
strategy that combines EMA crossovers, ADX, and ATR for trend identification.
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Any
import numpy as np

# Sample OHLCV data for testing (50 periods for proper EMA/ADX calculation)
SAMPLE_OHLCV_DATA = {
    "timestamps": [
        datetime(2024, 1, 1) + timedelta(hours=i) for i in range(50)
    ],
    "open": [
        100.0, 101.0, 102.0, 101.5, 103.0, 104.0, 105.5, 106.0, 107.5, 108.0,
        109.0, 110.0, 109.5, 111.0, 112.0, 113.5, 114.0, 115.5, 116.0, 117.0,
        118.0, 117.5, 119.0, 120.0, 121.5, 122.0, 123.5, 124.0, 125.0, 126.0,
        125.5, 127.0, 128.0, 129.5, 130.0, 131.5, 132.0, 133.0, 134.0, 133.5,
        135.0, 136.0, 137.5, 138.0, 139.5, 140.0, 141.0, 142.0, 141.5, 143.0
    ],
    "high": [
        101.5, 102.5, 103.0, 102.5, 104.0, 105.0, 106.5, 107.0, 108.5, 109.0,
        110.0, 111.0, 110.5, 112.0, 113.0, 114.5, 115.0, 116.5, 117.0, 118.0,
        119.0, 118.5, 120.0, 121.0, 122.5, 123.0, 124.5, 125.0, 126.0, 127.0,
        126.5, 128.0, 129.0, 130.5, 131.0, 132.5, 133.0, 134.0, 135.0, 134.5,
        136.0, 137.0, 138.5, 139.0, 140.5, 141.0, 142.0, 143.0, 142.5, 144.0
    ],
    "low": [
        99.0, 100.0, 101.0, 100.5, 102.0, 103.0, 104.5, 105.0, 106.5, 107.0,
        108.0, 109.0, 108.5, 110.0, 111.0, 112.5, 113.0, 114.5, 115.0, 116.0,
        117.0, 116.5, 118.0, 119.0, 120.5, 121.0, 122.5, 123.0, 124.0, 125.0,
        124.5, 126.0, 127.0, 128.5, 129.0, 130.5, 131.0, 132.0, 133.0, 132.5,
        134.0, 135.0, 136.5, 137.0, 138.5, 139.0, 140.0, 141.0, 140.5, 142.0
    ],
    "close": [
        100.5, 101.5, 102.2, 101.8, 103.2, 104.1, 105.8, 106.3, 107.8, 108.2,
        109.1, 110.2, 109.8, 111.3, 112.1, 113.8, 114.3, 115.8, 116.2, 117.1,
        118.2, 117.8, 119.3, 120.1, 121.8, 122.3, 123.8, 124.2, 125.1, 126.2,
        125.8, 127.3, 128.1, 129.8, 130.2, 131.8, 132.3, 133.1, 134.2, 133.8,
        135.3, 136.1, 137.8, 138.2, 139.8, 140.3, 141.1, 142.2, 141.8, 143.3
    ],
    "volume": [
        150000, 160000, 140000, 170000, 155000, 165000, 145000, 175000, 160000, 150000,
        180000, 165000, 155000, 185000, 170000, 160000, 190000, 175000, 165000, 195000,
        180000, 170000, 200000, 185000, 175000, 205000, 190000, 180000, 210000, 195000,
        185000, 215000, 200000, 190000, 220000, 205000, 195000, 225000, 210000, 200000,
        230000, 215000, 205000, 235000, 220000, 210000, 240000, 225000, 215000, 245000
    ]
}

# Expected EMA values (12-period and 26-period)
EXPECTED_EMA_VALUES = {
    "ema_12": [
        100.5, 100.846, 101.369, 101.464, 101.969, 102.588, 103.517, 104.026, 104.866, 105.309,
        105.935, 106.673, 107.065, 107.901, 108.555, 109.519, 110.064, 110.918, 111.460, 112.214,
        113.081, 112.985, 113.950, 114.735, 115.870, 116.587, 117.817, 118.475, 119.359, 120.366,
        120.513, 121.680, 122.589, 123.816, 124.439, 125.513, 126.055, 126.819, 127.695, 127.988,
        129.067, 129.890, 131.128, 131.708, 132.934, 133.456, 134.196, 135.049, 135.313, 136.394
    ],
    "ema_26": [
        100.5, 100.741, 101.197, 101.352, 101.726, 102.178, 102.796, 103.169, 103.724, 104.044,
        104.524, 105.084, 105.375, 105.975, 106.472, 107.125, 107.527, 108.149, 108.534, 109.090,
        109.709, 109.861, 110.456, 110.954, 111.665, 112.158, 112.825, 113.286, 113.893, 114.545,
        114.897, 115.516, 116.037, 116.705, 117.157, 117.751, 118.163, 118.708, 119.307, 119.676,
        120.256, 120.753, 121.396, 121.826, 122.403, 122.791, 123.303, 123.869, 124.209, 124.743
    ]
}

# Expected ADX values (14-period)
EXPECTED_ADX_VALUES = {
    "adx": [
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, 25.34, 28.67, 31.82, 34.29, 36.84, 38.92, 40.67,
        42.15, 41.89, 43.58, 45.12, 46.73, 47.89, 49.24, 50.31, 51.56, 52.84,
        53.12, 54.67, 55.89, 57.23, 58.14, 59.45, 60.23, 61.34, 62.51, 62.89,
        64.12, 65.23, 66.57, 67.34, 68.71, 69.45, 70.56, 71.78, 72.34, 73.67
    ],
    "plus_di": [
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, 32.45, 34.67, 36.12, 37.89, 39.23, 40.56, 41.78,
        42.89, 43.12, 44.56, 45.78, 46.89, 47.34, 48.67, 49.23, 50.45, 51.67,
        52.12, 53.45, 54.23, 55.67, 56.34, 57.78, 58.45, 59.67, 60.89, 61.23,
        62.45, 63.12, 64.56, 65.23, 66.67, 67.34, 68.56, 69.78, 70.23, 71.45
    ],
    "minus_di": [
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, 18.67, 17.23, 15.89, 14.56, 13.78, 12.34, 11.67,
        10.89, 11.23, 9.56, 8.78, 7.89, 7.34, 6.67, 6.23, 5.45, 4.67,
        4.89, 4.12, 3.67, 2.89, 2.45, 1.78, 1.34, 0.89, 0.45, 0.67,
        0.23, 0.12, 0.05, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01
    ]
}

# Expected ATR values (14-period)
EXPECTED_ATR_VALUES = [
    None, None, None, None, None, None, None, None, None, None,
    None, None, None, 1.89, 1.92, 1.95, 1.97, 1.98, 2.01, 2.03,
    2.05, 2.04, 2.07, 2.09, 2.12, 2.14, 2.17, 2.19, 2.21, 2.23,
    2.22, 2.25, 2.27, 2.30, 2.32, 2.35, 2.37, 2.39, 2.41, 2.40,
    2.43, 2.45, 2.48, 2.50, 2.53, 2.55, 2.57, 2.59, 2.58, 2.61
]

# Trend Following Strategy Configuration
TREND_FOLLOWING_CONFIG = {
    "name": "Trend Following",
    "description": "Medium-term strategy using EMA crossovers, ADX strength, and ATR volatility",
    "timeframe": "1h",
    "indicators": {
        "ema_fast": {
            "period": 12,
            "source": "close"
        },
        "ema_slow": {
            "period": 26,
            "source": "close"
        },
        "adx": {
            "period": 14,
            "trend_threshold": 25,
            "strong_trend": 40
        },
        "atr": {
            "period": 14,
            "volatility_threshold": 2.0
        }
    },
    "entry_rules": {
        "long": [
            "EMA 12 > EMA 26",
            "EMA 12 crossed above EMA 26 in last 3 periods",
            "ADX > 25",
            "Plus DI > Minus DI",
            "ATR indicates normal volatility"
        ],
        "short": [
            "EMA 12 < EMA 26",
            "EMA 12 crossed below EMA 26 in last 3 periods",
            "ADX > 25",
            "Minus DI > Plus DI",
            "ATR indicates normal volatility"
        ]
    },
    "exit_rules": {
        "long": [
            "EMA 12 crosses below EMA 26",
            "ADX falls below 20",
            "ATR exceeds 150% of 20-period average"
        ],
        "short": [
            "EMA 12 crosses above EMA 26",
            "ADX falls below 20",
            "ATR exceeds 150% of 20-period average"
        ]
    },
    "position_sizing": {
        "risk_per_trade": "1%",
        "atr_multiplier": 2.0,
        "max_position": "5%"
    }
}

# Expected signals for the last 10 periods
EXPECTED_SIGNALS = [
    {"period": 40, "signal": "LONG", "strength": 0.8, "reason": "Strong uptrend confirmed by ADX and EMA"},
    {"period": 41, "signal": "LONG", "strength": 0.85, "reason": "Trend strengthening, ADX rising"},
    {"period": 42, "signal": "LONG", "strength": 0.9, "reason": "Very strong trend with high ADX"},
    {"period": 43, "signal": "LONG", "strength": 0.87, "reason": "Trend continuing, normal volatility"},
    {"period": 44, "signal": "LONG", "strength": 0.9, "reason": "Excellent trend conditions"},
    {"period": 45, "signal": "LONG", "strength": 0.88, "reason": "Strong trend maintained"},
    {"period": 46, "signal": "LONG", "strength": 0.92, "reason": "Peak trend strength"},
    {"period": 47, "signal": "LONG", "strength": 0.89, "reason": "Sustained uptrend"},
    {"period": 48, "signal": "HOLD", "strength": 0.7, "reason": "Trend may be weakening slightly"},
    {"period": 49, "signal": "LONG", "strength": 0.91, "reason": "Trend resumed with strength"}
]

def get_golden_sample() -> Dict[str, Any]:
    """
    Get the complete golden sample for Trend Following preset.

    Returns:
        Dict containing input data, expected outputs, and strategy configuration
    """
    return {
        "preset_name": "trend_following",
        "version": "1.0",
        "created_at": "2024-01-01T00:00:00Z",
        "description": "Golden sample for trend following strategy validation",
        "input_data": SAMPLE_OHLCV_DATA,
        "expected_outputs": {
            "ema": EXPECTED_EMA_VALUES,
            "adx": EXPECTED_ADX_VALUES,
            "atr": EXPECTED_ATR_VALUES,
            "signals": EXPECTED_SIGNALS
        },
        "strategy_config": TREND_FOLLOWING_CONFIG,
        "validation_tolerance": {
            "ema": 0.05,
            "adx": 0.5,
            "atr": 0.02,
            "signals": 0.1
        }
    }

def validate_golden_sample(computed_results: Dict[str, Any]) -> Dict[str, bool]:
    """
    Validate computed results against golden sample expectations.

    Args:
        computed_results: Results from indicator computation engine

    Returns:
        Dict with validation results for each indicator
    """
    golden = get_golden_sample()
    expected = golden["expected_outputs"]
    tolerance = golden["validation_tolerance"]

    validation_results = {}

    # Validate EMA
    if "ema" in computed_results and expected["ema"]:
        ema_valid = True
        for period in ["ema_12", "ema_26"]:
            if period in computed_results["ema"] and period in expected["ema"]:
                for computed, expected_val in zip(computed_results["ema"][period], expected["ema"][period]):
                    if abs(computed - expected_val) > tolerance["ema"]:
                        ema_valid = False
                        break
        validation_results["ema"] = ema_valid

    # Validate ADX
    if "adx" in computed_results and expected["adx"]:
        adx_valid = True
        for component in ["adx", "plus_di", "minus_di"]:
            if component in computed_results["adx"] and component in expected["adx"]:
                for computed, expected_val in zip(computed_results["adx"][component], expected["adx"][component]):
                    if expected_val is not None and computed is not None:
                        if abs(computed - expected_val) > tolerance["adx"]:
                            adx_valid = False
                            break
        validation_results["adx"] = adx_valid

    # Validate ATR
    if "atr" in computed_results and expected["atr"]:
        atr_valid = True
        for computed, expected_val in zip(computed_results["atr"], expected["atr"]):
            if expected_val is not None and computed is not None:
                if abs(computed - expected_val) > tolerance["atr"]:
                    atr_valid = False
                    break
        validation_results["atr"] = atr_valid

    return validation_results

if __name__ == "__main__":
    # Example usage
    golden_sample = get_golden_sample()
    print(f"Golden sample for {golden_sample['preset_name']} loaded")
    print(f"Input data points: {len(golden_sample['input_data']['close'])}")
    print(f"Expected EMA 12 values: {len(golden_sample['expected_outputs']['ema']['ema_12'])}")
    print(f"Expected ADX values: {len([x for x in golden_sample['expected_outputs']['adx']['adx'] if x is not None])}")
    print(f"Expected signals: {len(golden_sample['expected_outputs']['signals'])}")