"""
Experiment tracking system for TurtleTrading research.

Provides lightweight experiment tracking and logging for research workflows.
Integrates with DVC pipelines and model registry.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
import uuid

logger = logging.getLogger(__name__)


@dataclass
class ExperimentRun:
    """Represents a single experiment run."""
    run_id: str
    experiment_name: str
    run_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str = "running"  # running, completed, failed
    parameters: Dict[str, Any] = None
    metrics: Dict[str, float] = None
    artifacts: Dict[str, str] = None  # artifact_name -> path
    tags: Dict[str, str] = None
    notes: str = ""
    git_commit: Optional[str] = None

    def __post_init__(self):
        if self.parameters is None:
            self.parameters = {}
        if self.metrics is None:
            self.metrics = {}
        if self.artifacts is None:
            self.artifacts = {}
        if self.tags is None:
            self.tags = {}


class ExperimentTracker:
    """
    Lightweight experiment tracking system.

    Features:
    - Experiment and run management
    - Parameter and metric logging
    - Artifact tracking
    - Integration with DVC pipelines
    - Comparison and analysis tools
    """

    def __init__(self, experiments_dir: Union[str, Path] = "experiments"):
        """
        Initialize experiment tracker.

        Args:
            experiments_dir: Directory to store experiment data
        """
        self.experiments_dir = Path(experiments_dir)
        self.experiments_dir.mkdir(parents=True, exist_ok=True)

        self.current_run: Optional[ExperimentRun] = None

    def start_run(self,
                  experiment_name: str,
                  run_name: Optional[str] = None,
                  parameters: Optional[Dict[str, Any]] = None,
                  tags: Optional[Dict[str, str]] = None) -> str:
        """
        Start a new experiment run.

        Args:
            experiment_name: Name of the experiment
            run_name: Name of the run (auto-generated if None)
            parameters: Run parameters
            tags: Run tags

        Returns:
            Run ID
        """
        run_id = str(uuid.uuid4())[:8]

        if run_name is None:
            run_name = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        self.current_run = ExperimentRun(
            run_id=run_id,
            experiment_name=experiment_name,
            run_name=run_name,
            start_time=datetime.now(),
            parameters=parameters or {},
            tags=tags or {}
        )

        logger.info(f"Started experiment run: {experiment_name}/{run_name} ({run_id})")
        return run_id

    def log_parameter(self, key: str, value: Any) -> None:
        """Log a parameter for the current run."""
        if self.current_run is None:
            raise ValueError("No active run. Call start_run() first.")

        self.current_run.parameters[key] = value
        logger.debug(f"Logged parameter: {key} = {value}")

    def log_parameters(self, parameters: Dict[str, Any]) -> None:
        """Log multiple parameters for the current run."""
        if self.current_run is None:
            raise ValueError("No active run. Call start_run() first.")

        self.current_run.parameters.update(parameters)
        logger.debug(f"Logged {len(parameters)} parameters")

    def log_metric(self, key: str, value: float, step: Optional[int] = None) -> None:
        """Log a metric for the current run."""
        if self.current_run is None:
            raise ValueError("No active run. Call start_run() first.")

        metric_key = f"{key}_step_{step}" if step is not None else key
        self.current_run.metrics[metric_key] = value
        logger.debug(f"Logged metric: {metric_key} = {value}")

    def log_metrics(self, metrics: Dict[str, float], step: Optional[int] = None) -> None:
        """Log multiple metrics for the current run."""
        if self.current_run is None:
            raise ValueError("No active run. Call start_run() first.")

        for key, value in metrics.items():
            self.log_metric(key, value, step)

    def log_artifact(self, artifact_name: str, artifact_path: str) -> None:
        """Log an artifact for the current run."""
        if self.current_run is None:
            raise ValueError("No active run. Call start_run() first.")

        self.current_run.artifacts[artifact_name] = artifact_path
        logger.debug(f"Logged artifact: {artifact_name} -> {artifact_path}")

    def set_tag(self, key: str, value: str) -> None:
        """Set a tag for the current run."""
        if self.current_run is None:
            raise ValueError("No active run. Call start_run() first.")

        self.current_run.tags[key] = value
        logger.debug(f"Set tag: {key} = {value}")

    def set_tags(self, tags: Dict[str, str]) -> None:
        """Set multiple tags for the current run."""
        if self.current_run is None:
            raise ValueError("No active run. Call start_run() first.")

        self.current_run.tags.update(tags)
        logger.debug(f"Set {len(tags)} tags")

    def add_note(self, note: str) -> None:
        """Add a note to the current run."""
        if self.current_run is None:
            raise ValueError("No active run. Call start_run() first.")

        if self.current_run.notes:
            self.current_run.notes += f"\n{note}"
        else:
            self.current_run.notes = note

        logger.debug(f"Added note: {note[:50]}...")

    def end_run(self, status: str = "completed") -> None:
        """End the current experiment run."""
        if self.current_run is None:
            raise ValueError("No active run to end.")

        self.current_run.end_time = datetime.now()
        self.current_run.status = status

        # Save run to disk
        self._save_run(self.current_run)

        logger.info(f"Ended experiment run: {self.current_run.experiment_name}/{self.current_run.run_name} ({status})")
        self.current_run = None

    def _save_run(self, run: ExperimentRun) -> None:
        """Save experiment run to disk."""
        experiment_dir = self.experiments_dir / run.experiment_name
        experiment_dir.mkdir(parents=True, exist_ok=True)

        run_file = experiment_dir / f"{run.run_id}_{run.run_name}.json"

        run_data = {
            **asdict(run),
            'start_time': run.start_time.isoformat(),
            'end_time': run.end_time.isoformat() if run.end_time else None
        }

        with open(run_file, 'w') as f:
            json.dump(run_data, f, indent=2, default=str)

    def load_run(self, experiment_name: str, run_id: str) -> Optional[ExperimentRun]:
        """Load an experiment run from disk."""
        experiment_dir = self.experiments_dir / experiment_name

        for run_file in experiment_dir.glob(f"{run_id}_*.json"):
            with open(run_file, 'r') as f:
                run_data = json.load(f)

            # Convert datetime strings back to datetime objects
            run_data['start_time'] = datetime.fromisoformat(run_data['start_time'])
            if run_data['end_time']:
                run_data['end_time'] = datetime.fromisoformat(run_data['end_time'])

            return ExperimentRun(**run_data)

        return None

    def list_experiments(self) -> List[str]:
        """List all experiment names."""
        experiments = []
        for exp_dir in self.experiments_dir.iterdir():
            if exp_dir.is_dir():
                experiments.append(exp_dir.name)
        return sorted(experiments)

    def list_runs(self, experiment_name: str) -> List[ExperimentRun]:
        """List all runs for an experiment."""
        experiment_dir = self.experiments_dir / experiment_name

        if not experiment_dir.exists():
            return []

        runs = []
        for run_file in experiment_dir.glob("*.json"):
            try:
                with open(run_file, 'r') as f:
                    run_data = json.load(f)

                # Convert datetime strings
                run_data['start_time'] = datetime.fromisoformat(run_data['start_time'])
                if run_data['end_time']:
                    run_data['end_time'] = datetime.fromisoformat(run_data['end_time'])

                runs.append(ExperimentRun(**run_data))
            except Exception as e:
                logger.warning(f"Failed to load run from {run_file}: {e}")

        return sorted(runs, key=lambda r: r.start_time, reverse=True)

    def compare_runs(self,
                     experiment_name: str,
                     run_ids: Optional[List[str]] = None,
                     metrics: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Compare runs within an experiment.

        Args:
            experiment_name: Name of experiment
            run_ids: Specific run IDs to compare (all if None)
            metrics: Specific metrics to compare (all if None)

        Returns:
            Comparison data
        """
        runs = self.list_runs(experiment_name)

        if run_ids:
            runs = [r for r in runs if r.run_id in run_ids]

        if not runs:
            return {"runs": [], "comparison": {}}

        comparison = {
            "experiment_name": experiment_name,
            "total_runs": len(runs),
            "runs": []
        }

        for run in runs:
            run_info = {
                "run_id": run.run_id,
                "run_name": run.run_name,
                "start_time": run.start_time.isoformat(),
                "status": run.status,
                "parameters": run.parameters,
                "metrics": {}
            }

            # Filter metrics if specified
            if metrics:
                run_info["metrics"] = {k: v for k, v in run.metrics.items() if k in metrics}
            else:
                run_info["metrics"] = run.metrics

            comparison["runs"].append(run_info)

        return comparison

    def get_best_run(self,
                     experiment_name: str,
                     metric: str,
                     higher_is_better: bool = False) -> Optional[ExperimentRun]:
        """
        Get the best run based on a metric.

        Args:
            experiment_name: Name of experiment
            metric: Metric to optimize
            higher_is_better: Whether higher values are better

        Returns:
            Best run or None
        """
        runs = self.list_runs(experiment_name)

        # Filter runs that have the metric
        runs_with_metric = [r for r in runs if metric in r.metrics]

        if not runs_with_metric:
            return None

        if higher_is_better:
            return max(runs_with_metric, key=lambda r: r.metrics[metric])
        else:
            return min(runs_with_metric, key=lambda r: r.metrics[metric])

    def delete_run(self, experiment_name: str, run_id: str) -> bool:
        """Delete an experiment run."""
        experiment_dir = self.experiments_dir / experiment_name

        for run_file in experiment_dir.glob(f"{run_id}_*.json"):
            run_file.unlink()
            logger.info(f"Deleted run {run_id} from experiment {experiment_name}")
            return True

        return False

    def export_experiment(self, experiment_name: str, output_path: str) -> None:
        """Export experiment data to JSON file."""
        runs = self.list_runs(experiment_name)

        export_data = {
            "experiment_name": experiment_name,
            "export_timestamp": datetime.now().isoformat(),
            "total_runs": len(runs),
            "runs": []
        }

        for run in runs:
            run_data = {
                **asdict(run),
                'start_time': run.start_time.isoformat(),
                'end_time': run.end_time.isoformat() if run.end_time else None
            }
            export_data["runs"].append(run_data)

        with open(output_path, 'w') as f:
            json.dump(export_data, f, indent=2, default=str)

        logger.info(f"Exported experiment '{experiment_name}' to {output_path}")


# Context manager for experiment runs
class experiment_run:
    """Context manager for experiment runs."""

    def __init__(self,
                 tracker: ExperimentTracker,
                 experiment_name: str,
                 run_name: Optional[str] = None,
                 parameters: Optional[Dict[str, Any]] = None,
                 tags: Optional[Dict[str, str]] = None):
        self.tracker = tracker
        self.experiment_name = experiment_name
        self.run_name = run_name
        self.parameters = parameters
        self.tags = tags
        self.run_id = None

    def __enter__(self) -> ExperimentTracker:
        self.run_id = self.tracker.start_run(
            self.experiment_name,
            self.run_name,
            self.parameters,
            self.tags
        )
        return self.tracker

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.tracker.end_run("failed")
        else:
            self.tracker.end_run("completed")