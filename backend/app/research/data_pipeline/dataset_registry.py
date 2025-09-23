"""
Dataset registry for tracking and versioning datasets.

Provides comprehensive dataset lifecycle management including:
- Dataset versioning and metadata tracking
- Data lineage and provenance tracking
- Quality metrics and validation history
- Dataset discovery and sharing
"""

import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
import logging
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class DatasetMetadata:
    """Metadata for a registered dataset."""
    dataset_id: str
    name: str
    version: str
    created_at: datetime
    author: str
    description: str

    # Data characteristics
    schema: Dict[str, str]  # column_name -> data_type
    row_count: int
    column_count: int
    file_size_mb: float
    data_hash: str

    # Data quality metrics
    quality_metrics: Dict[str, float]
    validation_results: Dict[str, Any]

    # Lineage information
    source_datasets: List[str]
    transformation_pipeline: str
    pipeline_version: str

    # Storage information
    storage_path: str
    storage_format: str

    # Usage and access
    access_count: int = 0
    last_accessed: Optional[datetime] = None

    # Tags and labels
    tags: Dict[str, str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = {}


class DatasetRegistry:
    """
    Registry for managing datasets and their lifecycle.

    Features:
    - Dataset versioning and metadata tracking
    - Data lineage and provenance
    - Quality monitoring and validation history
    - Dataset discovery and search
    - Access tracking and usage analytics
    """

    def __init__(self, registry_path: Union[str, Path]):
        """
        Initialize dataset registry.

        Args:
            registry_path: Path to the registry storage directory
        """
        self.registry_path = Path(registry_path)
        self.registry_path.mkdir(parents=True, exist_ok=True)

        self.catalog_path = self.registry_path / "dataset_catalog.json"
        self.datasets_path = self.registry_path / "datasets"
        self.datasets_path.mkdir(exist_ok=True)

        self._load_catalog()

    def _load_catalog(self) -> None:
        """Load the dataset catalog from disk."""
        if self.catalog_path.exists():
            with open(self.catalog_path, 'r') as f:
                catalog_data = json.load(f)
                self.catalog = {
                    dataset_id: DatasetMetadata(**{
                        **data,
                        'created_at': datetime.fromisoformat(data['created_at']),
                        'last_accessed': datetime.fromisoformat(data['last_accessed']) if data.get('last_accessed') else None
                    })
                    for dataset_id, data in catalog_data.items()
                }
        else:
            self.catalog = {}

    def _save_catalog(self) -> None:
        """Save the dataset catalog to disk."""
        catalog_data = {
            dataset_id: {
                **asdict(metadata),
                'created_at': metadata.created_at.isoformat(),
                'last_accessed': metadata.last_accessed.isoformat() if metadata.last_accessed else None
            }
            for dataset_id, metadata in self.catalog.items()
        }

        with open(self.catalog_path, 'w') as f:
            json.dump(catalog_data, f, indent=2, default=str)

    def register_dataset(self,
                        dataset: pd.DataFrame,
                        metadata: DatasetMetadata,
                        storage_format: str = "parquet") -> str:
        """
        Register a new dataset in the registry.

        Args:
            dataset: DataFrame to register
            metadata: Dataset metadata
            storage_format: Storage format (parquet, csv, feather)

        Returns:
            Dataset ID of the registered dataset
        """
        # Create dataset directory
        dataset_dir = self.datasets_path / metadata.dataset_id
        dataset_dir.mkdir(parents=True, exist_ok=True)

        # Save dataset
        dataset_file = dataset_dir / f"data.{storage_format}"

        try:
            if storage_format == "parquet":
                dataset.to_parquet(dataset_file, index=False)
            elif storage_format == "csv":
                dataset.to_csv(dataset_file, index=False)
            elif storage_format == "feather":
                dataset.to_feather(dataset_file)
            else:
                raise ValueError(f"Unsupported storage format: {storage_format}")

            logger.info(f"Saved dataset to {dataset_file}")

        except Exception as e:
            logger.error(f"Failed to save dataset: {e}")
            raise

        # Calculate dataset characteristics
        metadata.schema = {col: str(dtype) for col, dtype in dataset.dtypes.items()}
        metadata.row_count = len(dataset)
        metadata.column_count = len(dataset.columns)
        metadata.file_size_mb = dataset_file.stat().st_size / (1024 * 1024)
        metadata.data_hash = self._calculate_data_hash(dataset)
        metadata.storage_path = str(dataset_file)
        metadata.storage_format = storage_format

        # Save metadata
        metadata_file = dataset_dir / "metadata.json"
        with open(metadata_file, 'w') as f:
            metadata_dict = {
                **asdict(metadata),
                'created_at': metadata.created_at.isoformat(),
                'last_accessed': metadata.last_accessed.isoformat() if metadata.last_accessed else None
            }
            json.dump(metadata_dict, f, indent=2, default=str)

        # Add to catalog
        self.catalog[metadata.dataset_id] = metadata
        self._save_catalog()

        logger.info(f"Successfully registered dataset '{metadata.dataset_id}' version '{metadata.version}'")
        return metadata.dataset_id

    def get_dataset(self, dataset_id: str) -> Optional[DatasetMetadata]:
        """
        Get dataset metadata by ID.

        Args:
            dataset_id: Dataset identifier

        Returns:
            Dataset metadata or None if not found
        """
        return self.catalog.get(dataset_id)

    def load_dataset(self, dataset_id: str) -> pd.DataFrame:
        """
        Load dataset from storage.

        Args:
            dataset_id: Dataset identifier

        Returns:
            Loaded DataFrame
        """
        if dataset_id not in self.catalog:
            raise ValueError(f"Dataset '{dataset_id}' not found in registry")

        metadata = self.catalog[dataset_id]
        dataset_file = Path(metadata.storage_path)

        if not dataset_file.exists():
            raise FileNotFoundError(f"Dataset file not found: {dataset_file}")

        try:
            if metadata.storage_format == "parquet":
                dataset = pd.read_parquet(dataset_file)
            elif metadata.storage_format == "csv":
                dataset = pd.read_csv(dataset_file)
            elif metadata.storage_format == "feather":
                dataset = pd.read_feather(dataset_file)
            else:
                raise ValueError(f"Unsupported storage format: {metadata.storage_format}")

            # Update access tracking
            metadata.access_count += 1
            metadata.last_accessed = datetime.now()
            self._save_catalog()

            logger.info(f"Loaded dataset '{dataset_id}' ({len(dataset)} rows, {len(dataset.columns)} columns)")
            return dataset

        except Exception as e:
            logger.error(f"Failed to load dataset '{dataset_id}': {e}")
            raise

    def list_datasets(self,
                     tags: Optional[Dict[str, str]] = None,
                     name_pattern: Optional[str] = None,
                     sort_by: str = "created_at",
                     ascending: bool = False) -> List[DatasetMetadata]:
        """
        List datasets in the registry with optional filtering.

        Args:
            tags: Filter by tags (all specified tags must match)
            name_pattern: Filter by name pattern (substring match)
            sort_by: Sort by field name
            ascending: Sort order

        Returns:
            List of dataset metadata
        """
        datasets = list(self.catalog.values())

        # Apply filters
        if tags:
            datasets = [
                d for d in datasets
                if all(d.tags.get(k) == v for k, v in tags.items())
            ]

        if name_pattern:
            datasets = [d for d in datasets if name_pattern.lower() in d.name.lower()]

        # Sort datasets
        if sort_by in ['created_at', 'last_accessed']:
            datasets.sort(
                key=lambda d: getattr(d, sort_by) or datetime.min,
                reverse=not ascending
            )
        elif sort_by in ['row_count', 'column_count', 'file_size_mb', 'access_count']:
            datasets.sort(key=lambda d: getattr(d, sort_by), reverse=not ascending)
        elif sort_by == 'name':
            datasets.sort(key=lambda d: d.name, reverse=not ascending)

        return datasets

    def search_datasets(self, query: str) -> List[DatasetMetadata]:
        """
        Search datasets by name and description.

        Args:
            query: Search query string

        Returns:
            List of matching datasets
        """
        query_lower = query.lower()
        matches = []

        for dataset in self.catalog.values():
            if (query_lower in dataset.name.lower() or
                query_lower in dataset.description.lower() or
                any(query_lower in tag_value.lower() for tag_value in dataset.tags.values())):
                matches.append(dataset)

        return matches

    def get_dataset_lineage(self, dataset_id: str) -> Dict[str, Any]:
        """
        Get the lineage graph for a dataset.

        Args:
            dataset_id: Dataset identifier

        Returns:
            Lineage information
        """
        if dataset_id not in self.catalog:
            raise ValueError(f"Dataset '{dataset_id}' not found in registry")

        dataset = self.catalog[dataset_id]
        lineage = {
            "dataset_id": dataset_id,
            "name": dataset.name,
            "version": dataset.version,
            "created_at": dataset.created_at.isoformat(),
            "transformation_pipeline": dataset.transformation_pipeline,
            "pipeline_version": dataset.pipeline_version,
            "source_datasets": [],
            "derived_datasets": []
        }

        # Get source datasets
        for source_id in dataset.source_datasets:
            if source_id in self.catalog:
                source = self.catalog[source_id]
                lineage["source_datasets"].append({
                    "dataset_id": source_id,
                    "name": source.name,
                    "version": source.version,
                    "created_at": source.created_at.isoformat()
                })

        # Find derived datasets
        for candidate_id, candidate in self.catalog.items():
            if dataset_id in candidate.source_datasets:
                lineage["derived_datasets"].append({
                    "dataset_id": candidate_id,
                    "name": candidate.name,
                    "version": candidate.version,
                    "created_at": candidate.created_at.isoformat()
                })

        return lineage

    def validate_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """
        Validate dataset integrity and consistency.

        Args:
            dataset_id: Dataset identifier

        Returns:
            Validation results
        """
        if dataset_id not in self.catalog:
            raise ValueError(f"Dataset '{dataset_id}' not found in registry")

        metadata = self.catalog[dataset_id]
        dataset_file = Path(metadata.storage_path)

        validation_results = {
            "dataset_id": dataset_id,
            "validation_timestamp": datetime.now().isoformat(),
            "checks": {}
        }

        # Check file exists
        validation_results["checks"]["file_exists"] = dataset_file.exists()

        if not dataset_file.exists():
            validation_results["overall_status"] = "FAILED"
            return validation_results

        try:
            # Load dataset
            dataset = self.load_dataset(dataset_id)

            # Validate schema
            current_schema = {col: str(dtype) for col, dtype in dataset.dtypes.items()}
            validation_results["checks"]["schema_match"] = (current_schema == metadata.schema)

            # Validate row count
            validation_results["checks"]["row_count_match"] = (len(dataset) == metadata.row_count)

            # Validate column count
            validation_results["checks"]["column_count_match"] = (len(dataset.columns) == metadata.column_count)

            # Validate data hash
            current_hash = self._calculate_data_hash(dataset)
            validation_results["checks"]["data_hash_match"] = (current_hash == metadata.data_hash)

            # Check for missing values
            missing_values = dataset.isnull().sum().sum()
            validation_results["checks"]["missing_values"] = int(missing_values)

            # Check for duplicates
            duplicate_rows = dataset.duplicated().sum()
            validation_results["checks"]["duplicate_rows"] = int(duplicate_rows)

            # Overall status
            critical_checks = ["file_exists", "schema_match", "data_hash_match"]
            all_critical_passed = all(validation_results["checks"][check] for check in critical_checks)
            validation_results["overall_status"] = "PASSED" if all_critical_passed else "FAILED"

        except Exception as e:
            validation_results["checks"]["load_error"] = str(e)
            validation_results["overall_status"] = "ERROR"

        return validation_results

    def compare_datasets(self, dataset_ids: List[str]) -> pd.DataFrame:
        """
        Compare multiple datasets across key characteristics.

        Args:
            dataset_ids: List of dataset IDs to compare

        Returns:
            DataFrame with dataset comparison
        """
        if not dataset_ids:
            return pd.DataFrame()

        comparison_data = []

        for dataset_id in dataset_ids:
            if dataset_id not in self.catalog:
                logger.warning(f"Dataset '{dataset_id}' not found, skipping")
                continue

            dataset = self.catalog[dataset_id]
            row_data = {
                'dataset_id': dataset.dataset_id,
                'name': dataset.name,
                'version': dataset.version,
                'created_at': dataset.created_at,
                'author': dataset.author,
                'row_count': dataset.row_count,
                'column_count': dataset.column_count,
                'file_size_mb': dataset.file_size_mb,
                'access_count': dataset.access_count,
                'last_accessed': dataset.last_accessed,
                'storage_format': dataset.storage_format
            }

            # Add quality metrics
            row_data.update({f"quality_{k}": v for k, v in dataset.quality_metrics.items()})

            comparison_data.append(row_data)

        return pd.DataFrame(comparison_data)

    def get_usage_stats(self) -> Dict[str, Any]:
        """Get dataset usage statistics."""
        if not self.catalog:
            return {
                "total_datasets": 0,
                "total_size_mb": 0,
                "most_accessed": None,
                "recent_datasets": []
            }

        datasets = list(self.catalog.values())

        stats = {
            "total_datasets": len(datasets),
            "total_size_mb": sum(d.file_size_mb for d in datasets),
            "total_rows": sum(d.row_count for d in datasets),
            "storage_formats": {},
            "most_accessed": None,
            "least_accessed": None,
            "recent_datasets": []
        }

        # Count by storage format
        for dataset in datasets:
            fmt = dataset.storage_format
            if fmt not in stats["storage_formats"]:
                stats["storage_formats"][fmt] = 0
            stats["storage_formats"][fmt] += 1

        # Most/least accessed
        if datasets:
            stats["most_accessed"] = max(datasets, key=lambda d: d.access_count).dataset_id
            stats["least_accessed"] = min(datasets, key=lambda d: d.access_count).dataset_id

            # Recent datasets (last 5)
            recent = sorted(datasets, key=lambda d: d.created_at, reverse=True)[:5]
            stats["recent_datasets"] = [d.dataset_id for d in recent]

        return stats

    def _calculate_data_hash(self, dataset: pd.DataFrame) -> str:
        """Calculate hash of dataset contents."""
        # Convert to string representation for hashing
        data_string = dataset.to_string(index=False)
        return hashlib.md5(data_string.encode()).hexdigest()

    def tag_dataset(self, dataset_id: str, tags: Dict[str, str]) -> None:
        """
        Add tags to a dataset.

        Args:
            dataset_id: Dataset identifier
            tags: Dictionary of tags to add
        """
        if dataset_id not in self.catalog:
            raise ValueError(f"Dataset '{dataset_id}' not found in registry")

        metadata = self.catalog[dataset_id]
        metadata.tags.update(tags)
        self._save_catalog()

        logger.info(f"Added tags to dataset '{dataset_id}': {tags}")

    def delete_dataset(self, dataset_id: str, confirm: bool = False) -> None:
        """
        Delete a dataset from the registry.

        Args:
            dataset_id: Dataset identifier
            confirm: Confirmation flag for safety
        """
        if not confirm:
            raise ValueError("Must set confirm=True to delete a dataset")

        if dataset_id not in self.catalog:
            raise ValueError(f"Dataset '{dataset_id}' not found in registry")

        # Remove dataset files
        metadata = self.catalog[dataset_id]
        dataset_dir = Path(metadata.storage_path).parent
        if dataset_dir.exists():
            import shutil
            shutil.rmtree(dataset_dir)

        # Remove from catalog
        del self.catalog[dataset_id]
        self._save_catalog()

        logger.info(f"Deleted dataset '{dataset_id}' and all its files")