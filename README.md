**ATMOS AI** is an ensemble weather forecasting platform designed for SIH 2026 that dynamically blends predictions from state-of-the-art AI weather models using Bayesian Model Averaging (BMA) for high-resolution atmospheric forecasts.

**Core Models & Calibration**

GraphCast (DeepMind): GNN baseline for 0.25° medium-range global forecasts.
Pangu-Weather (Huawei): 3D Earth-transformer benchmark for medium-range pressure-level predictions.
FourCastNet (NVIDIA): Sub-second 0.25° global rollouts powered by Adaptive Fourier Neural Operators (AFNO).
BMA Theory: Statistical framework for dynamic multi-model ensemble weighting and probability density calibration.

**Ground Truth & Real-Time Data**

* **Verification Datasets:** ERA5 reanalysis and ECMWF Open Data/AIFS supply operational physical ground truth to calculate error metrics (RMSE, MAE, CRPS) and train weight gates.
* **Live Telemetry:** NOAA GFS via Open-Meteo API delivers real-time surface pressure, wind vectors, and dynamic weather inputs.
* **Precipitation Calibration:** NASA GPM IMERG satellite data benchmarks rainfall accuracy and triggers convective storm alerts.

**Standards & Source Code**

* **WMO Standard 4678:** Maps raw numerical telemetry into human-readable UI states and atmospheric alerts.
* **Repository:** Source code and dashboard implementation are available on GitHub at [`adrigoX4/ATMOS`](https://github.com/adrigoX4/ATMOS).
