import numpy as np
import xarray as xr
from typing import List, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class QuantileRegressionBlender:
    QUANTILES = [0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95]

    def __init__(self, quantiles: Optional[List[float]] = None):
        self.quantiles = quantiles or self.QUANTILES

    def compute_quantile_regression_weights(
        self,
        forecast_datasets: List[xr.Dataset],
        obs_dataset: xr.Dataset,
        variable_name: str,
    ) -> Tuple[xr.DataArray, Dict]:
        logger.info(f"Computing quantile regression weights for {variable_name}")

        n_models = len(forecast_datasets)

        model_forecasts = []
        for ds in forecast_datasets:
            if variable_name in ds:
                model_forecasts.append(ds[variable_name].values.flatten())

        if not model_forecasts:
            raise ValueError(f"No valid forecast data for {variable_name}")

        obs_values = obs_dataset[variable_name].values.flatten()
        min_len = min(len(obs_values), *[len(f) for f in model_forecasts])
        obs_values = obs_values[:min_len]
        model_forecasts = [f[:min_len] for f in model_forecasts]

        X = np.column_stack(model_forecasts)

        weights_per_quantile = {}
        for q in self.quantiles:
            weights = self._fit_quantile_regression(X, obs_values, q)
            weights_per_quantile[q] = weights

        weight_tensor = self._aggregate_quantile_weights(weights_per_quantile, n_models)

        uncertainty = self._compute_uncertainty_bounds(
            model_forecasts, obs_values, weights_per_quantile
        )

        return weight_tensor, uncertainty

    def _fit_quantile_regression(
        self, X: np.ndarray, y: np.ndarray, quantile: float
    ) -> np.ndarray:
        n_samples, n_features = X.shape

        try:
            from sklearn.linear_model import QuantileRegressor
            model = QuantileRegressor(
                quantile=quantile, alpha=0.01, solver="highs", fit_intercept=False
            )
            model.fit(X, y)
            weights = np.abs(model.coef_)
            weights = weights / (weights.sum() + 1e-10)
            return weights
        except ImportError:
            pass

        weights = np.ones(n_features) / n_features
        best_loss = float("inf")

        for _ in range(100):
            preds = X @ weights
            residuals = y - preds
            loss = np.mean(np.where(residuals >= 0, quantile * residuals, (quantile - 1) * residuals))

            gradients = np.zeros(n_features)
            for i in range(n_features):
                residuals_i = y - X[:, i] * weights[i]
                gradients[i] = np.mean(
                    np.where(residuals_i >= 0, quantile * X[:, i], (quantile - 1) * X[:, i])
                )

            lr = 0.001
            weights = weights - lr * gradients
            weights = np.maximum(weights, 0)
            if weights.sum() > 0:
                weights = weights / weights.sum()

            if abs(best_loss - loss) < 1e-8:
                break
            best_loss = loss

        return weights

    def _aggregate_quantile_weights(
        self, weights_per_quantile: Dict[float, np.ndarray], n_models: int
    ) -> xr.DataArray:
        median_q = 0.50
        if median_q in weights_per_quantile:
            return xr.DataArray(weights_per_quantile[median_q], dims=["model"])

        avg_weights = np.zeros(n_models)
        for q, w in weights_per_quantile.items():
            avg_weights += w
        avg_weights /= len(weights_per_quantile)
        return xr.DataArray(avg_weights, dims=["model"])

    def _compute_uncertainty_bounds(
        self,
        model_forecasts: List[np.ndarray],
        obs_values: np.ndarray,
        weights_per_quantile: Dict[float, np.ndarray],
    ) -> Dict:
        X = np.column_stack(model_forecasts)

        quantile_forecasts = {}
        for q, w in weights_per_quantile.items():
            quantile_forecasts[q] = X @ w

        median_forecast = quantile_forecasts.get(0.50, X.mean(axis=1))

        errors = obs_values - median_forecast
        rmse = float(np.sqrt(np.mean(errors**2)))
        mae = float(np.mean(np.abs(errors)))
        bias = float(np.mean(errors))

        spread_lower = quantile_forecasts.get(0.10, median_forecast - rmse) - median_forecast
        spread_upper = quantile_forecasts.get(0.90, median_forecast + rmse) - median_forecast

        crps_values = []
        for i in range(len(obs_values)):
            crps = 0
            for q, qf in quantile_forecasts.items():
                crps += abs(q - (obs_values[i] <= qf[i]).astype(float))
            crps_values.append(crps / len(self.quantiles))
        crps = float(np.mean(crps_values))

        return {
            "rmse": rmse,
            "mae": mae,
            "bias": bias,
            "crps": crps,
            "spread_lower": float(np.mean(np.abs(spread_lower))),
            "spread_upper": float(np.mean(np.abs(spread_upper))),
            "uncertainty_margin": float(np.mean(spread_upper - spread_lower)),
            "quantile_forecasts": {
                str(q): float(np.mean(qf)) for q, qf in quantile_forecasts.items()
            },
        }

    def generate_probabilistic_output(
        self,
        forecast_datasets: List[xr.Dataset],
        obs_dataset: xr.Dataset,
        variable_name: str,
    ) -> xr.Dataset:
        weight_tensor, uncertainty = self.compute_quantile_regression_weights(
            forecast_datasets, obs_dataset, variable_name
        )

        stacked = xr.concat(
            [ds[variable_name] for ds in forecast_datasets], dim="model"
        )

        median_forecast = (stacked * weight_tensor).sum(dim="model")

        quantile_outputs = {}
        for q in self.quantiles:
            q_weight = xr.DataArray(
                np.ones(len(forecast_datasets)) / len(forecast_datasets), dims=["model"]
            )
            quantile_outputs[f"q{int(q*100):02d}"] = (stacked * q_weight).sum(dim="model")

        uncertainty_margin = uncertainty.get("uncertainty_margin", 0)

        output_ds = xr.Dataset(
            {
                f"{variable_name}_median": median_forecast,
                f"{variable_name}_lower": median_forecast - uncertainty_margin,
                f"{variable_name}_upper": median_forecast + uncertainty_margin,
                **{f"{variable_name}_{k}": v for k, v in quantile_outputs.items()},
            },
            coords=forecast_datasets[0].coords,
        )

        output_ds.attrs["uncertainty_metrics"] = str(uncertainty)
        output_ds.attrs["quantiles"] = str(self.quantiles)

        return output_ds
