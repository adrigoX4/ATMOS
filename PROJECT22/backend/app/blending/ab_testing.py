import json
import logging
import random
import hashlib
from typing import Dict, List, Optional, Callable, Any
from datetime import datetime
from dataclasses import dataclass, asdict
from sqlalchemy.orm import Session

from app.models.models import BlendResult

logger = logging.getLogger(__name__)


@dataclass
class BlendingStrategy:
    name: str
    method: str
    params: Dict
    description: str


@dataclass
class ExperimentResult:
    experiment_id: str
    strategy_name: str
    metric_name: str
    value: float
    timestamp: str
    sample_size: int


class ABTestingFramework:
    """A/B testing framework for comparing blending strategies."""

    DEFAULT_STRATEGIES = [
        BlendingStrategy(
            name="inverse_error_variance",
            method="inverse_error_variance",
            params={"gamma": 2.0, "epsilon": 1e-6},
            description="Standard inverse error variance weighting",
        ),
        BlendingStrategy(
            name="exponential_smoothing",
            method="exponential_smoothing",
            params={"alpha": 0.3, "gamma": 2.0},
            description="Exponential smoothing with recent error emphasis",
        ),
        BlendingStrategy(
            name="gradient_boosted",
            method="gradient_boosted",
            params={"n_estimators": 100, "max_depth": 4},
            description="XGBoost meta-learner approach",
        ),
        BlendingStrategy(
            name="equal_weight",
            method="equal_weight",
            params={},
            description="Equal weight baseline",
        ),
    ]

    def __init__(self):
        self.active_experiments: Dict[str, Dict] = {}
        self.results: Dict[str, List[ExperimentResult]] = {}

    def create_experiment(
        self,
        experiment_name: str,
        strategies: Optional[List[BlendingStrategy]] = None,
        traffic_split: Optional[Dict[str, float]] = None,
    ) -> str:
        if strategies is None:
            strategies = self.DEFAULT_STRATEGIES

        if traffic_split is None:
            split = 1.0 / len(strategies)
            traffic_split = {s.name: split for s in strategies}

        experiment_id = hashlib.md5(
            f"{experiment_name}:{datetime.utcnow().isoformat()}".encode()
        ).hexdigest()[:12]

        self.active_experiments[experiment_id] = {
            "name": experiment_name,
            "strategies": {s.name: asdict(s) for s in strategies},
            "traffic_split": traffic_split,
            "created_at": datetime.utcnow().isoformat(),
            "status": "active",
        }

        self.results[experiment_id] = []
        logger.info(f"Created experiment {experiment_id}: {experiment_name}")
        return experiment_id

    def assign_strategy(self, experiment_id: str, request_id: str) -> str:
        if experiment_id not in self.active_experiments:
            raise ValueError(f"Experiment {experiment_id} not found")

        exp = self.active_experiments[experiment_id]
        hash_val = int(hashlib.md5(request_id.encode()).hexdigest(), 16) % 1000 / 1000.0

        cumulative = 0.0
        for strategy_name, split in exp["traffic_split"].items():
            cumulative += split
            if hash_val < cumulative:
                return strategy_name

        return list(exp["traffic_split"].keys())[-1]

    def record_result(
        self,
        experiment_id: str,
        strategy_name: str,
        metric_name: str,
        value: float,
        sample_size: int = 1,
    ):
        if experiment_id not in self.results:
            self.results[experiment_id] = []

        result = ExperimentResult(
            experiment_id=experiment_id,
            strategy_name=strategy_name,
            metric_name=metric_name,
            value=value,
            timestamp=datetime.utcnow().isoformat(),
            sample_size=sample_size,
        )
        self.results[experiment_id].append(result)

    def get_experiment_results(self, experiment_id: str) -> Dict:
        if experiment_id not in self.results:
            return {"error": "Experiment not found"}

        results = self.results[experiment_id]
        exp = self.active_experiments.get(experiment_id, {})

        strategy_metrics: Dict[str, Dict[str, List[float]]] = {}
        for r in results:
            if r.strategy_name not in strategy_metrics:
                strategy_metrics[r.strategy_name] = {}
            if r.metric_name not in strategy_metrics[r.strategy_name]:
                strategy_metrics[r.strategy_name][r.metric_name] = []
            strategy_metrics[r.strategy_name][r.metric_name].append(r.value)

        summary = {}
        for strategy, metrics in strategy_metrics.items():
            summary[strategy] = {}
            for metric, values in metrics.items():
                summary[strategy][metric] = {
                    "mean": sum(values) / len(values),
                    "min": min(values),
                    "max": max(values),
                    "std": (sum((v - sum(values)/len(values))**2 for v in values) / len(values)) ** 0.5,
                    "n_samples": len(values),
                }

        winner = {}
        for metric in set(r.metric_name for r in results):
            best_value = None
            best_strategy = None
            for strategy, metrics in summary.items():
                if metric in metrics:
                    val = metrics[metric]["mean"]
                    if best_value is None or val < best_value:
                        best_value = val
                        best_strategy = strategy
            winner[metric] = best_strategy

        return {
            "experiment_id": experiment_id,
            "name": exp.get("name", "unknown"),
            "status": exp.get("status", "unknown"),
            "strategy_summary": summary,
            "winner": winner,
            "total_results": len(results),
        }

    def stop_experiment(self, experiment_id: str) -> Dict:
        if experiment_id in self.active_experiments:
            self.active_experiments[experiment_id]["status"] = "completed"
            return self.get_experiment_results(experiment_id)
        return {"error": "Experiment not found"}

    def list_experiments(self) -> List[Dict]:
        return [
            {
                "id": eid,
                "name": exp["name"],
                "status": exp["status"],
                "created_at": exp["created_at"],
                "strategies": list(exp["strategies"].keys()),
            }
            for eid, exp in self.active_experiments.items()
        ]
