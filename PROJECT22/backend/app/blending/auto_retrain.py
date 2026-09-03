import logging
import numpy as np
import xarray as xr
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class SeasonalSkillProfile:
    season: str
    months: List[int]
    best_models: Dict[str, float]
    recommended_gamma: float
    recommended_lookback: int
    skill_scores: Dict[str, float]


class AutoRetrainer:
    """Automated model retraining based on seasonal skill changes."""

    SEASONS = {
        "winter": {"months": [12, 1, 2], "label": "DJF"},
        "pre_monsoon": {"months": [3, 4, 5], "label": "MAM"},
        "monsoon": {"months": [6, 7, 8], "label": "JJA"},
        "post_monsoon": {"months": [9, 10, 11], "label": "SON"},
    }

    def __init__(self, lookback_days: int = 90):
        self.lookback_days = lookback_days
        self.skill_history: Dict[str, List[Dict]] = {}
        self.current_profile: Optional[SeasonalSkillProfile] = None

    def analyze_seasonal_skill(
        self,
        forecast_datasets: List[xr.Dataset],
        obs_dataset: xr.Dataset,
        variable_name: str,
    ) -> SeasonalSkillProfile:
        """Analyze model skill for current season and recommend parameters."""
        current_month = datetime.utcnow().month
        current_season = self._get_season(current_month)

        logger.info(f"Analyzing seasonal skill for {current_season} ({variable_name})")

        model_skills = {}
        for ds in forecast_datasets:
            model_name = ds.attrs.get("model_name", "unknown")
            skill = self._compute_skill_score(ds, obs_dataset, variable_name)
            model_skills[model_name] = skill

        sorted_models = dict(
            sorted(model_skills.items(), key=lambda x: x[1], reverse=True)
        )

        recommended_gamma = self._recommend_gamma(current_season, variable_name)
        recommended_lookback = self._recommend_lookback(current_season)

        profile = SeasonalSkillProfile(
            season=current_season,
            months=self.SEASONS[current_season]["months"],
            best_models=sorted_models,
            recommended_gamma=recommended_gamma,
            recommended_lookback=recommended_lookback,
            skill_scores=model_skills,
        )

        self.current_profile = profile
        self._update_skill_history(profile)

        return profile

    def _get_season(self, month: int) -> str:
        for season, info in self.SEASONS.items():
            if month in info["months"]:
                return season
        return "winter"

    def _compute_skill_score(
        self,
        forecast: xr.Dataset,
        observation: xr.Dataset,
        variable_name: str,
    ) -> float:
        if variable_name not in forecast or variable_name not in observation:
            return 0.0

        try:
            fc = forecast[variable_name]
            obs = observation[variable_name]

            common_times = np.intersect1d(fc.time.values, obs.time.values)
            if len(common_times) == 0:
                return 0.0

            fc_aligned = fc.sel(time=common_times)
            obs_aligned = obs.sel(time=common_times)

            fc_mean = obs_aligned.mean().values
            total_variance = float(np.square(obs_aligned - fc_mean).mean().values)
            residual_variance = float(np.square(fc_aligned - obs_aligned).mean().values)

            if total_variance == 0:
                return 1.0

            nse = 1.0 - (residual_variance / total_variance)
            return max(0.0, nse)

        except Exception as e:
            logger.warning(f"Skill computation failed: {e}")
            return 0.0

    def _recommend_gamma(self, season: str, variable: str) -> float:
        gamma_map = {
            "winter": {"tp": 1.5, "t2m": 2.0, "u10": 1.8},
            "pre_monsoon": {"tp": 2.5, "t2m": 2.0, "u10": 2.2},
            "monsoon": {"tp": 3.0, "t2m": 1.8, "u10": 2.5},
            "post_monsoon": {"tp": 2.0, "t2m": 2.0, "u10": 2.0},
        }
        return gamma_map.get(season, {}).get(variable, 2.0)

    def _recommend_lookback(self, season: str) -> int:
        lookback_map = {
            "winter": 45,
            "pre_monsoon": 30,
            "monsoon": 20,
            "post_monsoon": 30,
        }
        return lookback_map.get(season, 30)

    def _update_skill_history(self, profile: SeasonalSkillProfile):
        season_key = profile.season
        if season_key not in self.skill_history:
            self.skill_history[season_key] = []

        self.skill_history[season_key].append({
            "timestamp": datetime.utcnow().isoformat(),
            "skill_scores": profile.skill_scores,
            "gamma": profile.recommended_gamma,
            "lookback": profile.recommended_lookback,
        })

        if len(self.skill_history[season_key]) > 30:
            self.skill_history[season_key] = self.skill_history[season_key][-30:]

    def detect_skill_drift(self) -> Dict:
        """Detect if model skill has significantly changed."""
        if not self.skill_history:
            return {"drift_detected": False, "message": "No history available"}

        current_season = self._get_season(datetime.utcnow().month)
        history = self.skill_history.get(current_season, [])

        if len(history) < 2:
            return {"drift_detected": False, "message": "Insufficient history"}

        recent = history[-1]["skill_scores"]
        previous = history[-2]["skill_scores"]

        drift_report = {"drift_detected": False, "changes": {}}

        for model in recent:
            if model in previous:
                change = recent[model] - previous[model]
                drift_report["changes"][model] = {
                    "previous": previous[model],
                    "current": recent[model],
                    "change": change,
                    "significant": abs(change) > 0.1,
                }
                if abs(change) > 0.15:
                    drift_report["drift_detected"] = True

        return drift_report

    def get_optimal_parameters(self) -> Dict:
        """Get optimal blending parameters based on current season."""
        if self.current_profile:
            return {
                "gamma": self.current_profile.recommended_gamma,
                "lookback": self.current_profile.recommended_lookback,
                "season": self.current_profile.season,
                "best_model": list(self.current_profile.best_models.keys())[0]
                if self.current_profile.best_models
                else None,
            }

        current_month = datetime.utcnow().month
        current_season = self._get_season(current_month)

        return {
            "gamma": self._recommend_gamma(current_season, "tp"),
            "lookback": self._recommend_lookback(current_season),
            "season": current_season,
            "best_model": None,
        }

    def should_retrain(self) -> Tuple[bool, str]:
        """Determine if retraining is needed based on skill drift."""
        drift = self.detect_skill_drift()

        if drift["drift_detected"]:
            changed = [
                m for m, c in drift.get("changes", {}).items()
                if c.get("significant", False)
            ]
            return True, f"Significant skill drift detected for: {', '.join(changed)}"

        if not self.current_profile:
            return True, "No current skill profile - initial training needed"

        return False, "Skill levels stable"

    def get_retraining_report(self) -> Dict:
        """Generate a comprehensive retraining report."""
        should_retrain, reason = self.should_retrain()
        optimal_params = self.get_optimal_parameters()
        drift_info = self.detect_skill_drift()

        return {
            "should_retrain": should_retrain,
            "reason": reason,
            "optimal_parameters": optimal_params,
            "skill_drift": drift_info,
            "current_profile": {
                "season": self.current_profile.season if self.current_profile else "unknown",
                "skill_scores": self.current_profile.skill_scores if self.current_profile else {},
                "best_models": self.current_profile.best_models if self.current_profile else {},
            } if self.current_profile else None,
            "history_length": sum(len(v) for v in self.skill_history.values()),
        }
