"""
Model registry for tracking and versioning trained models.

Provides comprehensive model lifecycle management including:
- Model versioning and metadata tracking
- Performance comparison and model selection
- Artifact storage and retrieval
- Model deployment readiness checks
"""

import json
import shutil
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
import logging
import pickle
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class ModelMetadata:
    """Metadata for a registered model."""
    model_id: str
    name: str
    version: str
    model_type: str
    framework: str
    created_at: datetime
    author: str
    description: str

    # Performance metrics
    metrics: Dict[str, float]
    validation_metrics: Dict[str, float]

    # Training information
    training_config: Dict[str, Any]
    feature_names: List[str]
    target_column: str
    preprocessing_params: Dict[str, Any]

    # Model artifacts
    model_path: str
    model_size_mb: float
    model_hash: str

    # Environment and reproducibility
    python_version: str
    dependencies: Dict[str, str]
    git_commit: Optional[str] = None

    # Deployment information
    deployment_ready: bool = False
    deployment_notes: str = ""

    # Tags and labels
    tags: Dict[str, str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = {}


class ModelRegistry:
    """
    Registry for managing trained models and their lifecycle.

    Features:
    - Model versioning and metadata tracking
    - Performance comparison and ranking
    - Artifact storage and organization
    - Model promotion and deployment
    - Experiment tracking integration
    """

    def __init__(self, registry_path: Union[str, Path]):
        """
        Initialize model registry.

        Args:
            registry_path: Path to the registry storage directory
        """
        self.registry_path = Path(registry_path)
        self.registry_path.mkdir(parents=True, exist_ok=True)

        self.catalog_path = self.registry_path / "model_catalog.json"
        self.models_path = self.registry_path / "models"
        self.models_path.mkdir(exist_ok=True)

        self._load_catalog()

    def _load_catalog(self) -> None:
        """Load the model catalog from disk."""
        if self.catalog_path.exists():
            with open(self.catalog_path, 'r') as f:
                catalog_data = json.load(f)
                self.catalog = {
                    model_id: ModelMetadata(**data)
                    for model_id, data in catalog_data.items()
                }
        else:
            self.catalog = {}

    def _save_catalog(self) -> None:
        """Save the model catalog to disk."""
        catalog_data = {
            model_id: {
                **asdict(metadata),
                'created_at': metadata.created_at.isoformat()
            }
            for model_id, metadata in self.catalog.items()
        }

        with open(self.catalog_path, 'w') as f:
            json.dump(catalog_data, f, indent=2, default=str)

    def register_model(self,
                      model_artifacts: Dict[str, Any],
                      metadata: ModelMetadata) -> str:
        """
        Register a new model in the registry.

        Args:
            model_artifacts: Dictionary containing model artifacts
            metadata: Model metadata

        Returns:
            Model ID of the registered model
        """
        # Create model directory
        model_dir = self.models_path / metadata.model_id
        model_dir.mkdir(parents=True, exist_ok=True)

        # Save model artifacts
        artifacts_saved = {}
        for artifact_name, artifact_data in model_artifacts.items():
            artifact_path = model_dir / f"{artifact_name}.pkl"

            try:
                if isinstance(artifact_data, (pd.DataFrame, pd.Series)):
                    artifact_data.to_pickle(artifact_path)
                elif isinstance(artifact_data, np.ndarray):
                    np.save(artifact_path.with_suffix('.npy'), artifact_data)
                elif isinstance(artifact_data, dict):
                    with open(artifact_path.with_suffix('.json'), 'w') as f:
                        json.dump(artifact_data, f, indent=2, default=str)
                else:
                    with open(artifact_path, 'wb') as f:
                        pickle.dump(artifact_data, f)

                artifacts_saved[artifact_name] = str(artifact_path)
                logger.info(f"Saved artifact '{artifact_name}' to {artifact_path}")

            except Exception as e:
                logger.error(f"Failed to save artifact '{artifact_name}': {e}")
                raise

        # Calculate model hash
        model_hash = self._calculate_model_hash(model_dir)
        metadata.model_hash = model_hash

        # Calculate model size
        model_size = sum(f.stat().st_size for f in model_dir.rglob('*') if f.is_file())
        metadata.model_size_mb = model_size / (1024 * 1024)

        # Update model path
        metadata.model_path = str(model_dir)

        # Add to catalog
        self.catalog[metadata.model_id] = metadata
        self._save_catalog()

        logger.info(f"Successfully registered model '{metadata.model_id}' version '{metadata.version}'")
        return metadata.model_id

    def get_model(self, model_id: str) -> Optional[ModelMetadata]:
        """
        Get model metadata by ID.

        Args:
            model_id: Model identifier

        Returns:
            Model metadata or None if not found
        """
        return self.catalog.get(model_id)

    def load_model_artifacts(self, model_id: str) -> Dict[str, Any]:
        """
        Load model artifacts from storage.

        Args:
            model_id: Model identifier

        Returns:
            Dictionary of loaded artifacts
        """
        if model_id not in self.catalog:
            raise ValueError(f"Model '{model_id}' not found in registry")

        model_dir = Path(self.catalog[model_id].model_path)
        artifacts = {}

        for artifact_file in model_dir.iterdir():
            if artifact_file.is_file():
                artifact_name = artifact_file.stem

                try:
                    if artifact_file.suffix == '.pkl':
                        if artifact_name.endswith('_df') or 'dataframe' in artifact_name:
                            artifacts[artifact_name] = pd.read_pickle(artifact_file)
                        else:
                            with open(artifact_file, 'rb') as f:
                                artifacts[artifact_name] = pickle.load(f)
                    elif artifact_file.suffix == '.npy':
                        artifacts[artifact_name] = np.load(artifact_file)
                    elif artifact_file.suffix == '.json':
                        with open(artifact_file, 'r') as f:
                            artifacts[artifact_name] = json.load(f)

                    logger.debug(f"Loaded artifact '{artifact_name}' from {artifact_file}")

                except Exception as e:
                    logger.warning(f"Failed to load artifact '{artifact_name}': {e}")

        return artifacts

    def list_models(self,
                   model_type: Optional[str] = None,
                   tags: Optional[Dict[str, str]] = None,
                   sort_by: str = "created_at",
                   ascending: bool = False) -> List[ModelMetadata]:
        """
        List models in the registry with optional filtering.

        Args:
            model_type: Filter by model type
            tags: Filter by tags (all specified tags must match)
            sort_by: Sort by field name
            ascending: Sort order

        Returns:
            List of model metadata
        """
        models = list(self.catalog.values())

        # Apply filters
        if model_type:
            models = [m for m in models if m.model_type == model_type]

        if tags:
            models = [
                m for m in models
                if all(m.tags.get(k) == v for k, v in tags.items())
            ]

        # Sort models
        if sort_by in ['created_at']:
            models.sort(key=lambda m: getattr(m, sort_by), reverse=not ascending)
        elif sort_by in ['version']:
            models.sort(key=lambda m: m.version, reverse=not ascending)
        elif sort_by in models[0].metrics.keys() if models else []:
            models.sort(key=lambda m: m.metrics.get(sort_by, 0), reverse=not ascending)

        return models

    def compare_models(self,
                      model_ids: List[str],
                      metrics: Optional[List[str]] = None) -> pd.DataFrame:
        """
        Compare multiple models across specified metrics.

        Args:
            model_ids: List of model IDs to compare
            metrics: List of metrics to compare (all if None)

        Returns:
            DataFrame with model comparison
        """
        if not model_ids:
            return pd.DataFrame()

        comparison_data = []

        for model_id in model_ids:
            if model_id not in self.catalog:
                logger.warning(f"Model '{model_id}' not found, skipping")
                continue

            model = self.catalog[model_id]
            row_data = {
                'model_id': model.model_id,
                'name': model.name,
                'version': model.version,
                'model_type': model.model_type,
                'created_at': model.created_at,
                'author': model.author,
                'model_size_mb': model.model_size_mb,
                'deployment_ready': model.deployment_ready
            }

            # Add metrics
            model_metrics = {**model.metrics, **model.validation_metrics}

            if metrics:
                for metric in metrics:
                    row_data[metric] = model_metrics.get(metric, np.nan)
            else:
                row_data.update(model_metrics)

            comparison_data.append(row_data)

        return pd.DataFrame(comparison_data)

    def promote_model(self,
                     model_id: str,
                     stage: str = "production",
                     notes: str = "") -> None:
        """
        Promote a model to a higher stage.

        Args:
            model_id: Model identifier
            stage: Target stage (staging, production, etc.)
            notes: Promotion notes
        """
        if model_id not in self.catalog:
            raise ValueError(f"Model '{model_id}' not found in registry")

        model = self.catalog[model_id]
        model.tags["stage"] = stage
        model.deployment_ready = (stage in ["staging", "production"])
        model.deployment_notes = notes

        self._save_catalog()
        logger.info(f"Promoted model '{model_id}' to '{stage}' stage")

    def archive_model(self, model_id: str, reason: str = "") -> None:
        """
        Archive a model (mark as deprecated).

        Args:
            model_id: Model identifier
            reason: Archival reason
        """
        if model_id not in self.catalog:
            raise ValueError(f"Model '{model_id}' not found in registry")

        model = self.catalog[model_id]
        model.tags["status"] = "archived"
        model.tags["archive_reason"] = reason
        model.deployment_ready = False

        self._save_catalog()
        logger.info(f"Archived model '{model_id}': {reason}")

    def delete_model(self, model_id: str, confirm: bool = False) -> None:
        """
        Delete a model from the registry.

        Args:
            model_id: Model identifier
            confirm: Confirmation flag for safety
        """
        if not confirm:
            raise ValueError("Must set confirm=True to delete a model")

        if model_id not in self.catalog:
            raise ValueError(f"Model '{model_id}' not found in registry")

        # Remove model artifacts
        model_dir = Path(self.catalog[model_id].model_path)
        if model_dir.exists():
            shutil.rmtree(model_dir)

        # Remove from catalog
        del self.catalog[model_id]
        self._save_catalog()

        logger.info(f"Deleted model '{model_id}' and all its artifacts")

    def get_best_model(self,
                      model_type: Optional[str] = None,
                      metric: str = "val_loss",
                      higher_is_better: bool = False,
                      tags: Optional[Dict[str, str]] = None) -> Optional[ModelMetadata]:
        """
        Get the best performing model based on a metric.

        Args:
            model_type: Filter by model type
            metric: Metric to optimize
            higher_is_better: Whether higher values are better
            tags: Filter by tags

        Returns:
            Best model metadata or None
        """
        models = self.list_models(model_type=model_type, tags=tags)

        if not models:
            return None

        # Filter models that have the specified metric
        models_with_metric = [
            m for m in models
            if metric in {**m.metrics, **m.validation_metrics}
        ]

        if not models_with_metric:
            return None

        # Find best model
        best_model = min(
            models_with_metric,
            key=lambda m: {**m.metrics, **m.validation_metrics}[metric] * (-1 if higher_is_better else 1)
        )

        return best_model

    def export_model_info(self, model_id: str, format: str = "json") -> str:
        """
        Export model information in specified format.

        Args:
            model_id: Model identifier
            format: Export format (json, yaml)

        Returns:
            Serialized model information
        """
        if model_id not in self.catalog:
            raise ValueError(f"Model '{model_id}' not found in registry")

        model = self.catalog[model_id]
        model_data = {
            **asdict(model),
            'created_at': model.created_at.isoformat()
        }

        if format == "json":
            return json.dumps(model_data, indent=2, default=str)
        elif format == "yaml":
            import yaml
            return yaml.dump(model_data, default_flow_style=False)
        else:
            raise ValueError(f"Unsupported format: {format}")

    def _calculate_model_hash(self, model_dir: Path) -> str:
        """Calculate hash of model directory contents."""
        hash_md5 = hashlib.md5()

        for file_path in sorted(model_dir.rglob('*')):
            if file_path.is_file():
                with open(file_path, 'rb') as f:
                    for chunk in iter(lambda: f.read(4096), b""):
                        hash_md5.update(chunk)

        return hash_md5.hexdigest()

    def get_registry_stats(self) -> Dict[str, Any]:
        """Get registry statistics."""
        if not self.catalog:
            return {
                "total_models": 0,
                "model_types": {},
                "deployment_ready": 0,
                "total_size_mb": 0
            }

        models = list(self.catalog.values())

        stats = {
            "total_models": len(models),
            "model_types": {},
            "deployment_ready": sum(1 for m in models if m.deployment_ready),
            "total_size_mb": sum(m.model_size_mb for m in models),
            "latest_model": max(models, key=lambda m: m.created_at).model_id,
            "oldest_model": min(models, key=lambda m: m.created_at).model_id
        }

        # Count by model type
        for model in models:
            model_type = model.model_type
            if model_type not in stats["model_types"]:
                stats["model_types"][model_type] = 0
            stats["model_types"][model_type] += 1

        return stats