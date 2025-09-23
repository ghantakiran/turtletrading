"""
Golden samples package for TA-Lib Indicator Lab validation.

This package contains reference data and expected outputs for common trading
strategy presets to ensure indicator computation accuracy.
"""

from .momentum_scalping_preset import get_golden_sample as get_momentum_scalping_sample
from .trend_following_preset import get_golden_sample as get_trend_following_sample
from .mean_reversion_preset import get_golden_sample as get_mean_reversion_sample

# Registry of all available golden samples
GOLDEN_SAMPLES_REGISTRY = {
    "momentum_scalping": get_momentum_scalping_sample,
    "trend_following": get_trend_following_sample,
    "mean_reversion": get_mean_reversion_sample,
}

def get_all_golden_samples():
    """Get all available golden samples."""
    return {name: getter() for name, getter in GOLDEN_SAMPLES_REGISTRY.items()}

def get_golden_sample(preset_name: str):
    """Get a specific golden sample by name."""
    if preset_name not in GOLDEN_SAMPLES_REGISTRY:
        raise ValueError(f"Unknown preset: {preset_name}. Available: {list(GOLDEN_SAMPLES_REGISTRY.keys())}")
    return GOLDEN_SAMPLES_REGISTRY[preset_name]()

__all__ = [
    "GOLDEN_SAMPLES_REGISTRY",
    "get_all_golden_samples",
    "get_golden_sample",
    "get_momentum_scalping_sample",
    "get_trend_following_sample",
    "get_mean_reversion_sample"
]