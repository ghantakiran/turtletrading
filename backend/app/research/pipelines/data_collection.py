#!/usr/bin/env python3
"""
Data collection pipeline script for DVC.

Collects stock market data from various sources and saves to DVC-tracked files.
This script is designed to be deterministic and reproducible.
"""

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

import pandas as pd
import numpy as np

# Add backend to path for imports
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from app.research.data_pipeline import DataLoader, DataSourceConfig
from app.research.data_pipeline.dataset_registry import DatasetRegistry, DatasetMetadata

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Set random seeds for reproducibility
np.random.seed(42)


def collect_stock_data(symbols: List[str], start_date: str, end_date: str) -> pd.DataFrame:
    """
    Collect stock data for specified symbols and date range.

    Args:
        symbols: List of stock symbols
        start_date: Start date string (YYYY-MM-DD)
        end_date: End date string (YYYY-MM-DD)

    Returns:
        Combined DataFrame with all stock data
    """
    logger.info(f"Collecting stock data for {len(symbols)} symbols from {start_date} to {end_date}")

    loader = DataLoader()
    all_data = []

    for symbol in symbols:
        logger.info(f"Collecting data for {symbol}")

        try:
            config = DataSourceConfig(
                source_type="api",  # This will create mock data for now
                path_or_connection="mock_api",
                symbol=symbol,
                start_date=datetime.strptime(start_date, "%Y-%m-%d"),
                end_date=datetime.strptime(end_date, "%Y-%m-%d"),
                cache_enabled=True
            )

            symbol_data = loader.load_stock_data(config)
            symbol_data['symbol'] = symbol
            all_data.append(symbol_data)

            logger.info(f"Collected {len(symbol_data)} records for {symbol}")

        except Exception as e:
            logger.error(f"Failed to collect data for {symbol}: {e}")
            continue

    if not all_data:
        raise ValueError("No data collected for any symbols")

    # Combine all data
    combined_data = pd.concat(all_data, ignore_index=True)

    # Add metadata columns
    combined_data['data_collection_date'] = datetime.now()
    combined_data['data_source'] = 'mock_api'

    logger.info(f"Total records collected: {len(combined_data)}")
    logger.info(f"Date range: {combined_data.index.min()} to {combined_data.index.max()}")
    logger.info(f"Symbols: {sorted(combined_data['symbol'].unique())}")

    return combined_data


def collect_market_data(symbols: List[str], start_date: str, end_date: str) -> pd.DataFrame:
    """
    Collect market index data.

    Args:
        symbols: List of stock symbols (will extract market indices)
        start_date: Start date string
        end_date: End date string

    Returns:
        Market data DataFrame
    """
    logger.info("Collecting market data")

    # Extract market indices from symbols
    market_indices = [s for s in symbols if s in ['SPY', 'QQQ', 'IWM', 'VIX']]

    if not market_indices:
        market_indices = ['SPY', 'QQQ', 'VIX']  # Default indices

    loader = DataLoader()

    try:
        config = DataSourceConfig(
            source_type="api",
            path_or_connection="mock_market_api",
            start_date=datetime.strptime(start_date, "%Y-%m-%d"),
            end_date=datetime.strptime(end_date, "%Y-%m-%d")
        )

        market_data = loader.load_market_data(market_indices, config)

        # Combine market data
        all_market_data = []
        for symbol, data in market_data.items():
            data['symbol'] = symbol
            data['data_type'] = 'market_index'
            all_market_data.append(data)

        combined_market_data = pd.concat(all_market_data, ignore_index=True)

        logger.info(f"Collected market data for {len(market_indices)} indices")
        return combined_market_data

    except Exception as e:
        logger.error(f"Failed to collect market data: {e}")
        raise


def collect_sentiment_data(symbols: List[str], start_date: str, end_date: str) -> pd.DataFrame:
    """
    Collect sentiment data.

    Args:
        symbols: List of stock symbols
        start_date: Start date string
        end_date: End date string

    Returns:
        Sentiment data DataFrame
    """
    logger.info("Collecting sentiment data")

    loader = DataLoader()
    all_sentiment_data = []

    # Collect sentiment for main stock symbols (not indices)
    stock_symbols = [s for s in symbols if s not in ['SPY', 'QQQ', 'IWM', 'VIX']]

    for symbol in stock_symbols[:5]:  # Limit to first 5 for demo
        try:
            config = DataSourceConfig(
                source_type="api",
                path_or_connection="mock_sentiment_api",
                symbol=symbol,
                start_date=datetime.strptime(start_date, "%Y-%m-%d"),
                end_date=datetime.strptime(end_date, "%Y-%m-%d")
            )

            sentiment_data = loader.load_sentiment_data(config)
            sentiment_data['symbol'] = symbol
            all_sentiment_data.append(sentiment_data)

        except Exception as e:
            logger.warning(f"Failed to collect sentiment data for {symbol}: {e}")
            continue

    if all_sentiment_data:
        combined_sentiment = pd.concat(all_sentiment_data, ignore_index=True)
        logger.info(f"Collected sentiment data for {len(all_sentiment_data)} symbols")
        return combined_sentiment
    else:
        # Create empty sentiment DataFrame with expected structure
        logger.warning("No sentiment data collected, creating empty DataFrame")
        return pd.DataFrame(columns=[
            'news_sentiment', 'social_sentiment', 'analyst_sentiment',
            'news_count', 'social_mentions', 'news_volume',
            'news_confidence', 'social_confidence', 'symbol'
        ])


def save_metrics(output_path: str, metrics: Dict[str, Any]) -> None:
    """Save collection metrics to JSON file."""
    metrics_path = Path(output_path)
    metrics_path.parent.mkdir(parents=True, exist_ok=True)

    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=2, default=str)

    logger.info(f"Saved metrics to {metrics_path}")


def register_datasets(stock_data: pd.DataFrame, market_data: pd.DataFrame,
                     sentiment_data: pd.DataFrame, registry_path: str) -> None:
    """Register datasets in the dataset registry."""
    registry = DatasetRegistry(registry_path)

    # Register stock data
    stock_metadata = DatasetMetadata(
        dataset_id="stock_data_v1",
        name="Stock Price Data",
        version="1.0.0",
        created_at=datetime.now(),
        author="TurtleTrading Data Pipeline",
        description="Historical stock price data with OHLCV information",
        schema={},  # Will be filled automatically
        row_count=0,  # Will be filled automatically
        column_count=0,  # Will be filled automatically
        file_size_mb=0.0,  # Will be filled automatically
        data_hash="",  # Will be filled automatically
        quality_metrics={
            "completeness": len(stock_data.dropna()) / len(stock_data) if len(stock_data) > 0 else 0,
            "uniqueness": 1 - (stock_data.duplicated().sum() / len(stock_data)) if len(stock_data) > 0 else 0
        },
        validation_results={},
        source_datasets=[],
        transformation_pipeline="data_collection",
        pipeline_version="1.0.0",
        storage_path="",  # Will be filled automatically
        storage_format="parquet",
        tags={"type": "stock_data", "stage": "raw", "version": "v1"}
    )

    try:
        registry.register_dataset(stock_data, stock_metadata, "parquet")
        logger.info("Registered stock data in dataset registry")
    except Exception as e:
        logger.warning(f"Failed to register stock data: {e}")

    # Register market data
    if len(market_data) > 0:
        market_metadata = DatasetMetadata(
            dataset_id="market_data_v1",
            name="Market Index Data",
            version="1.0.0",
            created_at=datetime.now(),
            author="TurtleTrading Data Pipeline",
            description="Market index data (SPY, QQQ, VIX, etc.)",
            schema={},
            row_count=0,
            column_count=0,
            file_size_mb=0.0,
            data_hash="",
            quality_metrics={
                "completeness": len(market_data.dropna()) / len(market_data),
                "uniqueness": 1 - (market_data.duplicated().sum() / len(market_data))
            },
            validation_results={},
            source_datasets=[],
            transformation_pipeline="data_collection",
            pipeline_version="1.0.0",
            storage_path="",
            storage_format="parquet",
            tags={"type": "market_data", "stage": "raw", "version": "v1"}
        )

        try:
            registry.register_dataset(market_data, market_metadata, "parquet")
            logger.info("Registered market data in dataset registry")
        except Exception as e:
            logger.warning(f"Failed to register market data: {e}")


def main():
    """Main data collection pipeline."""
    parser = argparse.ArgumentParser(description="Collect stock market data for DVC pipeline")
    parser.add_argument("--symbols", required=True, help="Comma-separated list of stock symbols")
    parser.add_argument("--start-date", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", required=True, help="End date (YYYY-MM-DD)")
    parser.add_argument("--output", required=True, help="Output file path for stock data")

    args = parser.parse_args()

    # Parse symbols
    symbols = [s.strip() for s in args.symbols.split(",")]

    logger.info(f"Starting data collection pipeline")
    logger.info(f"Symbols: {symbols}")
    logger.info(f"Date range: {args.start_date} to {args.end_date}")

    try:
        # Collect data
        stock_data = collect_stock_data(symbols, args.start_date, args.end_date)
        market_data = collect_market_data(symbols, args.start_date, args.end_date)
        sentiment_data = collect_sentiment_data(symbols, args.start_date, args.end_date)

        # Create output directories
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        market_output = output_path.parent / "market_data.parquet"
        sentiment_output = output_path.parent / "sentiment_data.parquet"

        # Save data
        stock_data.to_parquet(args.output, index=False)
        market_data.to_parquet(market_output, index=False)
        sentiment_data.to_parquet(sentiment_output, index=False)

        logger.info(f"Saved stock data to {args.output}")
        logger.info(f"Saved market data to {market_output}")
        logger.info(f"Saved sentiment data to {sentiment_output}")

        # Register datasets
        try:
            register_datasets(stock_data, market_data, sentiment_data, "data/registry")
        except Exception as e:
            logger.warning(f"Failed to register datasets: {e}")

        # Create metrics
        metrics = {
            "collection_timestamp": datetime.now().isoformat(),
            "symbols_requested": len(symbols),
            "symbols_collected": len(stock_data['symbol'].unique()),
            "total_stock_records": len(stock_data),
            "total_market_records": len(market_data),
            "total_sentiment_records": len(sentiment_data),
            "date_range": {
                "start": args.start_date,
                "end": args.end_date,
                "actual_start": str(stock_data.index.min()) if len(stock_data) > 0 else None,
                "actual_end": str(stock_data.index.max()) if len(stock_data) > 0 else None
            },
            "data_quality": {
                "stock_completeness": len(stock_data.dropna()) / len(stock_data) if len(stock_data) > 0 else 0,
                "market_completeness": len(market_data.dropna()) / len(market_data) if len(market_data) > 0 else 0,
                "sentiment_completeness": len(sentiment_data.dropna()) / len(sentiment_data) if len(sentiment_data) > 0 else 0
            }
        }

        save_metrics("metrics/data_collection.json", metrics)

        logger.info("Data collection pipeline completed successfully")

    except Exception as e:
        logger.error(f"Data collection pipeline failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()