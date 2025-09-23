"""
Golden samples for Momentum Scalping indicator preset.

This module contains reference data and expected outputs for the Momentum Scalping
strategy that combines RSI, MACD, and Stochastic indicators for short-term trading.
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Any
import numpy as np

# Sample OHLCV data for testing (60 periods for proper indicator calculation)
SAMPLE_OHLCV_DATA = {
    "timestamps": [
        datetime(2024, 1, 1) + timedelta(minutes=i * 5) for i in range(60)
    ],
    "open": [
        100.0, 100.5, 101.0, 100.8, 101.2, 101.5, 102.0, 101.8, 102.5, 103.0,
        102.8, 103.2, 103.8, 104.0, 103.5, 104.2, 104.8, 105.0, 104.5, 105.2,
        105.8, 106.0, 105.5, 106.2, 106.8, 107.0, 106.5, 107.2, 107.8, 108.0,
        107.5, 108.2, 108.8, 109.0, 108.5, 109.2, 109.8, 110.0, 109.5, 110.2,
        110.8, 111.0, 110.5, 111.2, 111.8, 112.0, 111.5, 112.2, 112.8, 113.0,
        112.5, 113.2, 113.8, 114.0, 113.5, 114.2, 114.8, 115.0, 114.5, 115.2
    ],
    "high": [
        100.8, 101.2, 101.5, 101.5, 101.8, 102.2, 102.5, 102.5, 103.2, 103.5,
        103.5, 103.8, 104.5, 104.8, 104.2, 104.8, 105.5, 105.8, 105.2, 105.8,
        106.5, 106.8, 106.2, 106.8, 107.5, 107.8, 107.2, 107.8, 108.5, 108.8,
        108.2, 108.8, 109.5, 109.8, 109.2, 109.8, 110.5, 110.8, 110.2, 110.8,
        111.5, 111.8, 111.2, 111.8, 112.5, 112.8, 112.2, 112.8, 113.5, 113.8,
        113.2, 113.8, 114.5, 114.8, 114.2, 114.8, 115.5, 115.8, 115.2, 115.8
    ],
    "low": [
        99.5, 100.0, 100.2, 100.0, 100.5, 101.0, 101.2, 101.0, 101.8, 102.2,
        102.0, 102.5, 103.0, 103.2, 102.8, 103.5, 104.0, 104.2, 103.8, 104.5,
        105.0, 105.2, 104.8, 105.5, 106.0, 106.2, 105.8, 106.5, 107.0, 107.2,
        106.8, 107.5, 108.0, 108.2, 107.8, 108.5, 109.0, 109.2, 108.8, 109.5,
        110.0, 110.2, 109.8, 110.5, 111.0, 111.2, 110.8, 111.5, 112.0, 112.2,
        111.8, 112.5, 113.0, 113.2, 112.8, 113.5, 114.0, 114.2, 113.8, 114.5
    ],
    "close": [
        100.2, 100.8, 100.5, 101.0, 101.6, 102.0, 101.5, 102.2, 102.8, 102.5,
        103.0, 103.6, 104.0, 103.8, 104.0, 104.6, 105.0, 104.8, 105.0, 105.6,
        106.0, 105.8, 106.0, 106.6, 107.0, 106.8, 107.0, 107.6, 108.0, 107.8,
        108.0, 108.6, 109.0, 108.8, 109.0, 109.6, 110.0, 109.8, 110.0, 110.6,
        111.0, 110.8, 111.0, 111.6, 112.0, 111.8, 112.0, 112.6, 113.0, 112.8,
        113.0, 113.6, 114.0, 113.8, 114.0, 114.6, 115.0, 114.8, 115.0, 115.2
    ],
    "volume": [
        100000, 120000, 95000, 110000, 130000, 105000, 140000, 115000, 125000, 98000,
        135000, 108000, 122000, 92000, 118000, 145000, 112000, 138000, 101000, 128000,
        95000, 132000, 107000, 126000, 99000, 119000, 142000, 114000, 133000, 102000,
        127000, 96000, 121000, 148000, 116000, 139000, 104000, 129000, 98000, 124000,
        151000, 118000, 141000, 106000, 131000, 100000, 125000, 154000, 120000, 143000,
        108000, 133000, 102000, 127000, 157000, 122000, 145000, 110000, 135000, 104000
    ]
}

# Expected RSI values (14-period RSI)
EXPECTED_RSI_VALUES = [
    None, None, None, None, None, None, None, None, None, None,
    None, None, None, 65.22, 68.46, 70.53, 71.78, 70.09, 71.20, 72.61,
    73.68, 72.32, 73.06, 74.29, 75.25, 74.11, 74.67, 75.81, 76.59, 75.68,
    76.11, 77.19, 77.82, 76.99, 77.35, 78.33, 78.83, 78.09, 78.41, 79.29,
    79.71, 79.02, 79.31, 80.12, 80.47, 79.84, 80.09, 80.84, 81.14, 80.56,
    80.78, 81.47, 81.72, 81.19, 81.39, 82.02, 82.24, 81.75, 81.93, 82.01
]

# Expected MACD values (12, 26, 9)
EXPECTED_MACD_VALUES = {
    "macd_line": [
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, None, None, 0.35, 0.47, 0.61, 0.74, 0.83,
        0.91, 1.02, 1.13, 1.21, 1.28, 1.38, 1.47, 1.53, 1.58, 1.67,
        1.75, 1.81, 1.86, 1.94, 2.01, 2.06, 2.10, 2.18, 2.25, 2.30,
        2.34, 2.41, 2.47, 2.52, 2.56, 2.63, 2.68, 2.72, 2.76, 2.79
    ],
    "signal_line": [
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, 0.35, 0.39, 0.45, 0.52, 0.58, 0.64, 0.71,
        0.78, 0.84, 0.89, 0.95, 1.01, 1.06, 1.10, 1.16, 1.22, 1.27,
        1.31, 1.37, 1.42, 1.47, 1.51, 1.56, 1.61, 1.65, 1.69, 1.72
    ],
    "histogram": [
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, 0.86, 0.89, 0.93, 0.95, 0.95, 0.94, 0.96,
        0.97, 0.97, 0.97, 0.99, 1.00, 1.00, 1.00, 1.02, 1.03, 1.03,
        1.03, 1.04, 1.05, 1.05, 1.05, 1.07, 1.07, 1.07, 1.07, 1.07
    ]
}

# Expected Stochastic values (14, 3, 3)
EXPECTED_STOCHASTIC_VALUES = {
    "k_percent": [
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, 67.86, 75.00, 78.57, 82.14, 78.57, 82.14, 85.71,
        89.29, 85.71, 89.29, 92.86, 96.43, 92.86, 96.43, 100.00, 96.43, 92.86,
        96.43, 100.00, 96.43, 92.86, 96.43, 100.00, 96.43, 92.86, 96.43, 100.00,
        96.43, 92.86, 96.43, 100.00, 96.43, 92.86, 96.43, 100.00, 96.43, 92.86,
        96.43, 100.00, 96.43, 92.86, 96.43, 100.00, 96.43, 92.86, 96.43, 100.00
    ],
    "d_percent": [
        None, None, None, None, None, None, None, None, None, None,
        None, None, None, None, None, 73.81, 78.57, 79.76, 82.95, 82.14,
        85.71, 87.30, 89.29, 89.29, 92.86, 95.24, 95.24, 96.43, 97.62, 96.43,
        95.24, 96.43, 97.62, 96.43, 95.24, 96.43, 97.62, 96.43, 95.24, 96.43,
        97.62, 96.43, 95.24, 96.43, 97.62, 96.43, 95.24, 96.43, 97.62, 96.43,
        95.24, 96.43, 97.62, 96.43, 95.24, 96.43, 97.62, 96.43, 95.24, 96.43
    ]
}

# Momentum Scalping Strategy Configuration
MOMENTUM_SCALPING_CONFIG = {
    "name": "Momentum Scalping",
    "description": "High-frequency trading strategy using RSI, MACD, and Stochastic for momentum detection",
    "timeframe": "5min",
    "indicators": {
        "rsi": {
            "period": 14,
            "overbought": 70,
            "oversold": 30
        },
        "macd": {
            "fast_period": 12,
            "slow_period": 26,
            "signal_period": 9
        },
        "stochastic": {
            "k_period": 14,
            "k_slowing": 3,
            "d_period": 3,
            "overbought": 80,
            "oversold": 20
        }
    },
    "entry_rules": {
        "long": [
            "RSI > 50 and RSI < 70",
            "MACD line > signal line",
            "MACD histogram > 0",
            "Stochastic %K > 20 and %K < 80",
            "Stochastic %K > %D"
        ],
        "short": [
            "RSI < 50 and RSI > 30",
            "MACD line < signal line",
            "MACD histogram < 0",
            "Stochastic %K < 80 and %K > 20",
            "Stochastic %K < %D"
        ]
    },
    "exit_rules": {
        "take_profit": "1.5%",
        "stop_loss": "0.75%",
        "time_exit": "30 minutes"
    }
}

# Expected signals for the last 10 periods
EXPECTED_SIGNALS = [
    {"period": 50, "signal": "HOLD", "strength": 0.6, "reason": "RSI overbought, MACD positive"},
    {"period": 51, "signal": "WEAK_LONG", "strength": 0.7, "reason": "All indicators aligned for momentum"},
    {"period": 52, "signal": "LONG", "strength": 0.8, "reason": "Strong momentum confirmation"},
    {"period": 53, "signal": "LONG", "strength": 0.7, "reason": "Momentum continuing"},
    {"period": 54, "signal": "HOLD", "strength": 0.6, "reason": "RSI approaching overbought"},
    {"period": 55, "signal": "WEAK_LONG", "strength": 0.7, "reason": "MACD histogram positive"},
    {"period": 56, "signal": "LONG", "strength": 0.8, "reason": "Stochastic momentum strong"},
    {"period": 57, "signal": "HOLD", "strength": 0.6, "reason": "Mixed signals"},
    {"period": 58, "signal": "WEAK_LONG", "strength": 0.7, "reason": "MACD divergence forming"},
    {"period": 59, "signal": "LONG", "strength": 0.8, "reason": "Final momentum push"}
]

def get_golden_sample() -> Dict[str, Any]:
    """
    Get the complete golden sample for Momentum Scalping preset.

    Returns:
        Dict containing input data, expected outputs, and strategy configuration
    """
    return {
        "preset_name": "momentum_scalping",
        "version": "1.0",
        "created_at": "2024-01-01T00:00:00Z",
        "description": "Golden sample for momentum scalping strategy validation",
        "input_data": SAMPLE_OHLCV_DATA,
        "expected_outputs": {
            "rsi": EXPECTED_RSI_VALUES,
            "macd": EXPECTED_MACD_VALUES,
            "stochastic": EXPECTED_STOCHASTIC_VALUES,
            "signals": EXPECTED_SIGNALS
        },
        "strategy_config": MOMENTUM_SCALPING_CONFIG,
        "validation_tolerance": {
            "rsi": 0.1,
            "macd": 0.01,
            "stochastic": 0.1,
            "signals": 0.05
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

    # Validate RSI
    if "rsi" in computed_results and expected["rsi"]:
        rsi_valid = True
        for i, (computed, expected_val) in enumerate(zip(computed_results["rsi"], expected["rsi"])):
            if expected_val is not None and computed is not None:
                if abs(computed - expected_val) > tolerance["rsi"]:
                    rsi_valid = False
                    break
        validation_results["rsi"] = rsi_valid

    # Validate MACD
    if "macd" in computed_results and expected["macd"]:
        macd_valid = True
        for component in ["macd_line", "signal_line", "histogram"]:
            if component in computed_results["macd"] and component in expected["macd"]:
                for computed, expected_val in zip(computed_results["macd"][component], expected["macd"][component]):
                    if expected_val is not None and computed is not None:
                        if abs(computed - expected_val) > tolerance["macd"]:
                            macd_valid = False
                            break
        validation_results["macd"] = macd_valid

    # Validate Stochastic
    if "stochastic" in computed_results and expected["stochastic"]:
        stoch_valid = True
        for component in ["k_percent", "d_percent"]:
            if component in computed_results["stochastic"] and component in expected["stochastic"]:
                for computed, expected_val in zip(computed_results["stochastic"][component], expected["stochastic"][component]):
                    if expected_val is not None and computed is not None:
                        if abs(computed - expected_val) > tolerance["stochastic"]:
                            stoch_valid = False
                            break
        validation_results["stochastic"] = stoch_valid

    return validation_results

if __name__ == "__main__":
    # Example usage
    golden_sample = get_golden_sample()
    print(f"Golden sample for {golden_sample['preset_name']} loaded")
    print(f"Input data points: {len(golden_sample['input_data']['close'])}")
    print(f"Expected RSI values: {len([x for x in golden_sample['expected_outputs']['rsi'] if x is not None])}")
    print(f"Expected signals: {len(golden_sample['expected_outputs']['signals'])}")