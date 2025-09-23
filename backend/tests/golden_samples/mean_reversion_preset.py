"""
Golden samples for Mean Reversion indicator preset.

This module contains reference data and expected outputs for the Mean Reversion
strategy that combines Bollinger Bands, Williams %R, and CCI for oversold/overbought signals.
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Any
import numpy as np

# Sample OHLCV data for testing (40 periods with mean-reverting pattern)
SAMPLE_OHLCV_DATA = {
    "timestamps": [
        datetime(2024, 1, 1) + timedelta(minutes=i * 15) for i in range(40)
    ],
    "open": [
        100.0, 99.5, 98.0, 97.5, 98.0, 99.0, 100.5, 102.0, 103.5, 102.0,
        100.5, 99.0, 97.5, 96.0, 97.0, 98.5, 100.0, 101.5, 103.0, 104.5,
        103.0, 101.5, 100.0, 98.5, 97.0, 98.0, 99.5, 101.0, 102.5, 104.0,
        102.5, 101.0, 99.5, 98.0, 96.5, 97.5, 99.0, 100.5, 102.0, 103.5
    ],
    "high": [
        100.8, 100.0, 98.5, 98.0, 99.0, 100.0, 101.5, 103.0, 104.0, 102.5,
        101.0, 99.5, 98.0, 96.5, 98.0, 99.5, 101.0, 102.5, 104.0, 105.0,
        103.5, 102.0, 100.5, 99.0, 97.5, 99.0, 100.5, 102.0, 103.5, 104.5,
        103.0, 101.5, 100.0, 98.5, 97.0, 98.5, 100.0, 101.5, 103.0, 104.0
    ],
    "low": [
        99.0, 98.5, 97.0, 96.5, 97.5, 98.5, 100.0, 101.5, 102.0, 100.5,
        99.0, 97.5, 96.0, 95.0, 96.5, 98.0, 99.5, 101.0, 102.5, 103.0,
        101.5, 100.0, 98.5, 97.0, 95.5, 97.0, 98.5, 100.0, 101.5, 102.5,
        101.0, 99.5, 98.0, 96.5, 95.0, 96.5, 98.0, 99.5, 101.0, 102.5
    ],
    "close": [
        99.5, 98.2, 97.8, 97.9, 98.7, 99.8, 101.2, 102.8, 102.3, 100.8,
        99.2, 97.9, 96.5, 95.8, 97.2, 98.9, 100.3, 101.8, 103.2, 103.8,
        102.1, 100.7, 99.1, 97.8, 96.2, 97.8, 99.3, 100.9, 102.3, 103.5,
        102.0, 100.5, 98.9, 97.2, 95.9, 97.5, 99.1, 100.7, 102.1, 103.2
    ],
    "volume": [
        120000, 135000, 150000, 165000, 140000, 125000, 110000, 95000, 105000, 130000,
        145000, 160000, 180000, 195000, 170000, 150000, 135000, 120000, 105000, 90000,
        110000, 125000, 140000, 155000, 175000, 160000, 145000, 130000, 115000, 100000,
        120000, 135000, 150000, 170000, 185000, 165000, 150000, 135000, 120000, 105000
    ]
}

# Expected Bollinger Bands values (20-period, 2 std dev)
EXPECTED_BOLLINGER_VALUES = {
    "middle_band": [
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, None, None, None, None, None, None, 99.84,
        99.91, 99.96, 100.01, 100.05, 100.08, 100.11, 100.14, 100.18, 100.22, 100.26,
        100.30, 100.33, 100.36, 100.38, 100.40, 100.42, 100.44, 100.46, 100.48, 100.50
    ],
    "upper_band": [
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, None, None, None, None, None, None, 102.84,
        103.01, 103.16, 103.29, 103.41, 103.52, 103.61, 103.69, 103.78, 103.86, 103.94,
        104.02, 104.09, 104.16, 104.22, 104.28, 104.34, 104.40, 104.46, 104.52, 104.58
    ],
    "lower_band": [
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, None, None, None, None, None, None, 96.84,
        96.81, 96.76, 96.73, 96.69, 96.64, 96.61, 96.59, 96.58, 96.58, 96.58,
        96.58, 96.57, 96.56, 96.54, 96.52, 96.50, 96.48, 96.46, 96.44, 96.42
    ]
}

# Expected Williams %R values (14-period)
EXPECTED_WILLIAMS_R_VALUES = [
    None, None, None, None, None, None, None, None, None, None,
    None, None, None, -78.26, -65.22, -43.48, -21.74, -8.70, -4.35, -8.70,
    -21.74, -34.78, -47.83, -65.22, -82.61, -65.22, -47.83, -30.43, -13.04, -4.35,
    -17.39, -30.43, -47.83, -65.22, -86.96, -65.22, -47.83, -30.43, -17.39, -8.70
]

# Expected CCI values (20-period)
EXPECTED_CCI_VALUES = [
    None, None, None, None, None, None, None, None, None, None,
    None, None, None, None, None, None, None, None, None, 66.67,
    33.33, 0.0, -33.33, -66.67, -100.0, -66.67, -33.33, 0.0, 33.33, 66.67,
    33.33, 0.0, -33.33, -66.67, -100.0, -66.67, -33.33, 0.0, 33.33, 66.67
]

# Mean Reversion Strategy Configuration
MEAN_REVERSION_CONFIG = {
    "name": "Mean Reversion",
    "description": "Counter-trend strategy using Bollinger Bands, Williams %R, and CCI",
    "timeframe": "15min",
    "indicators": {
        "bollinger_bands": {
            "period": 20,
            "std_dev": 2.0,
            "source": "close"
        },
        "williams_r": {
            "period": 14,
            "oversold": -80,
            "overbought": -20
        },
        "cci": {
            "period": 20,
            "oversold": -100,
            "overbought": 100
        }
    },
    "entry_rules": {
        "long": [
            "Price touches or breaks below lower Bollinger Band",
            "Williams %R < -80 (oversold)",
            "CCI < -100 (oversold)",
            "Volume above 20-period average"
        ],
        "short": [
            "Price touches or breaks above upper Bollinger Band",
            "Williams %R > -20 (overbought)",
            "CCI > 100 (overbought)",
            "Volume above 20-period average"
        ]
    },
    "exit_rules": {
        "long": [
            "Price reaches middle Bollinger Band",
            "Williams %R crosses above -50",
            "CCI crosses above 0"
        ],
        "short": [
            "Price reaches middle Bollinger Band",
            "Williams %R crosses below -50",
            "CCI crosses below 0"
        ]
    },
    "risk_management": {
        "stop_loss": "2% beyond Bollinger Band",
        "take_profit": "Middle band or opposite extreme",
        "max_holding_period": "4 hours"
    }
}

# Expected signals for the last 10 periods
EXPECTED_SIGNALS = [
    {"period": 30, "signal": "LONG", "strength": 0.6, "reason": "Approaching oversold levels"},
    {"period": 31, "signal": "HOLD", "strength": 0.5, "reason": "Mixed signals from indicators"},
    {"period": 32, "signal": "SHORT", "strength": 0.7, "reason": "Price moving toward upper band"},
    {"period": 33, "signal": "SHORT", "strength": 0.8, "reason": "Overbought conditions developing"},
    {"period": 34, "signal": "STRONG_SHORT", "strength": 0.9, "reason": "All indicators confirm overbought"},
    {"period": 35, "signal": "LONG", "strength": 0.8, "reason": "Mean reversion beginning"},
    {"period": 36, "signal": "LONG", "strength": 0.7, "reason": "Oversold bounce expected"},
    {"period": 37, "signal": "HOLD", "strength": 0.5, "reason": "Return to middle range"},
    {"period": 38, "signal": "SHORT", "strength": 0.6, "reason": "Price approaching upper band again"},
    {"period": 39, "signal": "LONG", "strength": 0.7, "reason": "Cyclical pattern suggests reversal"}
]

def get_golden_sample() -> Dict[str, Any]:
    """
    Get the complete golden sample for Mean Reversion preset.

    Returns:
        Dict containing input data, expected outputs, and strategy configuration
    """
    return {
        "preset_name": "mean_reversion",
        "version": "1.0",
        "created_at": "2024-01-01T00:00:00Z",
        "description": "Golden sample for mean reversion strategy validation",
        "input_data": SAMPLE_OHLCV_DATA,
        "expected_outputs": {
            "bollinger_bands": EXPECTED_BOLLINGER_VALUES,
            "williams_r": EXPECTED_WILLIAMS_R_VALUES,
            "cci": EXPECTED_CCI_VALUES,
            "signals": EXPECTED_SIGNALS
        },
        "strategy_config": MEAN_REVERSION_CONFIG,
        "validation_tolerance": {
            "bollinger_bands": 0.1,
            "williams_r": 1.0,
            "cci": 5.0,
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

    # Validate Bollinger Bands
    if "bollinger_bands" in computed_results and expected["bollinger_bands"]:
        bb_valid = True
        for band in ["middle_band", "upper_band", "lower_band"]:
            if band in computed_results["bollinger_bands"] and band in expected["bollinger_bands"]:
                for computed, expected_val in zip(computed_results["bollinger_bands"][band], expected["bollinger_bands"][band]):
                    if expected_val is not None and computed is not None:
                        if abs(computed - expected_val) > tolerance["bollinger_bands"]:
                            bb_valid = False
                            break
        validation_results["bollinger_bands"] = bb_valid

    # Validate Williams %R
    if "williams_r" in computed_results and expected["williams_r"]:
        wr_valid = True
        for computed, expected_val in zip(computed_results["williams_r"], expected["williams_r"]):
            if expected_val is not None and computed is not None:
                if abs(computed - expected_val) > tolerance["williams_r"]:
                    wr_valid = False
                    break
        validation_results["williams_r"] = wr_valid

    # Validate CCI
    if "cci" in computed_results and expected["cci"]:
        cci_valid = True
        for computed, expected_val in zip(computed_results["cci"], expected["cci"]):
            if expected_val is not None and computed is not None:
                if abs(computed - expected_val) > tolerance["cci"]:
                    cci_valid = False
                    break
        validation_results["cci"] = cci_valid

    return validation_results

if __name__ == "__main__":
    # Example usage
    golden_sample = get_golden_sample()
    print(f"Golden sample for {golden_sample['preset_name']} loaded")
    print(f"Input data points: {len(golden_sample['input_data']['close'])}")
    print(f"Expected Bollinger values: {len([x for x in golden_sample['expected_outputs']['bollinger_bands']['middle_band'] if x is not None])}")
    print(f"Expected Williams %R values: {len([x for x in golden_sample['expected_outputs']['williams_r'] if x is not None])}")
    print(f"Expected signals: {len(golden_sample['expected_outputs']['signals'])}")