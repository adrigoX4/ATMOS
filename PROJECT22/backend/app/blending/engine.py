import numpy as np
import xarray as xr
from typing import List, Dict, Optional, Tuple
import logging
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class DynamicBlendingEngine:
    """Core blending engine implementing adaptive weight tensor computation."""

    def __init__(
        self,
        lookback_steps: int = 30,
        gamma: float = 2.0,
        epsilon: float = 1e-6,
    ):
        self.lookback_steps = lookback_steps
        self.gamma = gamma
        self.epsilon = epsilon

    def compute_inverse_error_variance_weights(
        self,
        forecast_datasets: List[xr.Dataset],
        obs_dataset: xr.Dataset,
        variable_name: str,
        temporal_window: Optional[int] = None,
    ) -> xr.DataArray:
        """
        Compute adaptive weights using inverse error variance method.

        For each grid cell, the weight of model m is:
        w_m = (1 / MSE_m)^gamma / sum((1 / MSE_m)^gamma)
        """
        if temporal_window is None:
            temporal_window = self.lookback_steps

        logger.info(f"Computing weights for {variable_name} with window={temporal_window}")

        mse_maps = []
        for ds in forecast_datasets:
            if variable_name not in ds:
                logger.warning(f"Variable {variable_name} not found in dataset")
                continue

            residuals = ds[variable_name] - obs_dataset[variable_name]
            residuals = residuals.isel(
                time=slice(-temporal_window, None) if len(residuals.time) > temporal_window else None
            )

            mse = np.square(residuals).mean(dim="time")

            mse_smoothed = mse.rolling(
                latitude=3, longitude=3, center=True, min_periods=1
            ).mean()

            mse_maps.append(mse_smoothed)

        if not mse_maps:
            raise ValueError(f"No valid forecast datasets for variable {variable_name}")

        stacked_mse = xr.concat(mse_maps, dim="model")

        inverse_mse = 1.0 / (stacked_mse + self.epsilon) ** self.gamma

        weight_tensor = inverse_mse / inverse_mse.sum(dim="model")

        return weight_tensor

    def compute_gradient_boosted_weights(
        self,
        forecast_datasets: List[xr.Dataset],
        obs_dataset: xr.Dataset,
        variable_name: str,
        temporal_window: Optional[int] = None,
    ) -> xr.DataArray:
        """
        Compute weights using a gradient boosted meta-learner approach.
        Uses recent verification data to train an XGBoost model.
        """
        if temporal_window is None:
            temporal_window = self.lookback_steps

        logger.info(f"Computing XGBoost weights for {variable_name}")

        mse_weights = self.compute_inverse_error_variance_weights(
            forecast_datasets, obs_dataset, variable_name, temporal_window
        )

        try:
            import xgboost as xgb

            X_train = []
            y_train = []

            for t_idx, time_val in enumerate(obs_dataset.time.values):
                if t_idx >= len(obs_dataset.time) - temporal_window:
                    for lat_idx, lat in enumerate(obs_dataset.latitude.values):
                        for lon_idx, lon in enumerate(obs_dataset.longitude.values):
                            obs_val = float(obs_dataset[variable_name].sel(
                                time=time_val, latitude=lat, longitude=lon
                            ).values)

                            model_features = []
                            for ds in forecast_datasets:
                                if variable_name in ds:
                                    forecast_val = float(ds[variable_name].sel(
                                        time=time_val, latitude=lat, longitude=lon
                                    ).values)
                                    model_features.append(forecast_val)

                            if len(model_features) == len(forecast_datasets) and not np.isnan(obs_val):
                                X_train.append(model_features)
                                y_train.append(obs_val)

            if len(X_train) > 100:
                X_train = np.array(X_train)
                y_train = np.array(y_train)

                model = xgb.XGBRegressor(
                    n_estimators=100,
                    max_depth=4,
                    learning_rate=0.1,
                    objective="reg:squarederror",
                    random_state=42,
                )
                model.fit(X_train, y_train)

                importance = model.feature_importances_
                importance = importance / importance.sum()

                adjusted_weights = mse_weights.copy()
                for m_idx in range(len(forecast_datasets)):
                    adjusted_weights[m_idx] *= importance[m_idx]

                adjusted_weights = adjusted_weights / adjusted_weights.sum(dim="model")

                return adjusted_weights

        except ImportError:
            logger.warning("XGBoost not available, falling back to inverse error variance")

        return mse_weights

    def apply_blending(
        self,
        forecast_datasets: List[xr.Dataset],
        weight_tensor: xr.DataArray,
        variable_name: str,
    ) -> xr.DataArray:
        """Apply computed weights to combine model forecasts."""
        stacked_forecasts = xr.concat(
            [ds[variable_name] for ds in forecast_datasets], dim="model"
        )

        if "model" not in weight_tensor.dims:
            weight_tensor = weight_tensor.expand_dims("model")

        weight_broadcast = weight_tensor.broadcast_like(stacked_forecasts)

        blended_forecast = (stacked_forecasts * weight_broadcast).sum(dim="model")

        return blended_forecast

    def compute_blended_dataset(
        self,
        forecast_datasets: List[xr.Dataset],
        obs_dataset: xr.Dataset,
        variables: List[str],
        weight_method: str = "inverse_error_variance",
    ) -> Tuple[xr.Dataset, xr.DataArray]:
        """
        Compute complete blended forecast dataset with weight tensor.
        """
        blended_vars = {}
        all_weights = {}

        for var in variables:
            logger.info(f"Blending variable: {var}")

            if weight_method == "inverse_error_variance":
                weights = self.compute_inverse_error_variance_weights(
                    forecast_datasets, obs_dataset, var
                )
            elif weight_method == "gradient_boosted":
                weights = self.compute_gradient_boosted_weights(
                    forecast_datasets, obs_dataset, var
                )
            else:
                raise ValueError(f"Unknown weight method: {weight_method}")

            blended = self.apply_blending(forecast_datasets, weights, var)
            blended_vars[f"{var}_blended"] = blended
            all_weights[var] = weights

        blended_ds = xr.Dataset(blended_vars, coords=forecast_datasets[0].coords)

        weight_ds = xr.Dataset(all_weights)

        return blended_ds, weight_ds

    def detect_extreme_events(
        self,
        blended_forecast: xr.Dataset,
        thresholds: Optional[Dict[str, float]] = None,
    ) -> List[Dict]:
        """
        Detect extreme weather events based on IMD thresholds.
        """
        if thresholds is None:
            thresholds = {
                "tp": {"heavy": 64.5, "extreme": 115.5},
                "t2m": {"heatwave": 40.0},
                "u10": {"severe_wind": 27.0},
            }

        alerts = []

        for var, thresh_vals in thresholds.items():
            var_key = f"{var}_blended" if f"{var}_blended" in blended_forecast else var
            if var_key not in blended_forecast:
                continue

            data = blended_forecast[var_key]

            for thresh_name, thresh_val in thresh_vals.items():
                extreme_mask = data > thresh_val if thresh_val > 0 else data < thresh_val

                if extreme_mask.any():
                    extreme_indices = np.where(extreme_mask.values)

                    for idx in zip(*extreme_indices):
                        lat_idx, lon_idx = idx[-2], idx[-1]
                        lat = float(data.latitude.values[lat_idx])
                        lon = float(data.longitude.values[lon_idx])
                        val = float(data.values[idx])

                        alerts.append({
                            "variable": var,
                            "type": thresh_name,
                            "severity": self._classify_severity(thresh_name, val, thresh_val),
                            "latitude": lat,
                            "longitude": lon,
                            "value": val,
                            "threshold": thresh_val,
                            "message": f"{thresh_name.upper()} detected at ({lat:.2f}, {lon:.2f}): {val:.1f} exceeds {thresh_val}",
                        })

        return alerts

    def _classify_severity(
        self, event_type: str, value: float, threshold: float
    ) -> str:
        """Classify severity level of extreme event."""
        ratio = value / threshold if threshold > 0 else 1.0

        if ratio >= 1.5:
            return "EXTREME"
        elif ratio >= 1.2:
            return "SEVERE"
        elif ratio >= 1.0:
            return "MODERATE"
        return "LOW"

    def compute_verification_metrics(
        self,
        forecast: xr.Dataset,
        observation: xr.Dataset,
        variable_name: str,
    ) -> Dict[str, float]:
        """Compute verification metrics (RMSE, MAE, Bias) for a forecast."""
        if variable_name not in forecast or variable_name not in observation:
            return {}

        fc = forecast[variable_name]
        obs = observation[variable_name]

        common_times = np.intersect1d(fc.time.values, obs.time.values)
        if len(common_times) == 0:
            return {}

        fc_aligned = fc.sel(time=common_times)
        obs_aligned = obs.sel(time=common_times)

        errors = fc_aligned - obs_aligned

        rmse = float(np.sqrt(np.square(errors).mean().values))
        mae = float(np.abs(errors).mean().values)
        bias = float(errors.mean().values)

        return {
            "rmse": rmse,
            "mae": mae,
            "bias": bias,
        }

    def save_blended_output(
        self,
        blended_ds: xr.Dataset,
        weight_ds: xr.Dataset,
        output_path: str,
    ) -> Dict[str, str]:
        """Save blended output and weight maps."""
        blend_path = f"{output_path}/blended.zarr"
        weight_path = f"{output_path}/weights.zarr"

        blended_ds.to_zarr(blend_path, mode="w")
        weight_ds.to_zarr(weight_path, mode="w")

        return {
            "blended_path": blend_path,
            "weight_path": weight_path,
        }
