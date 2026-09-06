# ATMOS AI - Research & References

**Project Repository**
* **ATMOS AI Source Code**
  * *Usage:* Official project repository containing the frontend dashboard, blending pipeline, and implementation code for SIH 2026.
  * *Link:* https://github.com/adrigoX4/ATMOS

### AI Weather Models & Blending Science
* **GraphCast (Google DeepMind)**
  * *Reference:* Lam et al. (2023), *Learning skillful medium-range global weather forecasting*, Science 382, 1416–1421.
  * *Usage:* Baseline for high-resolution 0.25° medium-range forecasts and global Graph Neural Network (GNN) architecture comparisons.
  * *Link:* https://doi.org/10.1126/science.adi2336

* **Pangu-Weather (Huawei Cloud)**
  * *Reference:* Bi et al. (2023), *Accurate medium-range global weather forecasting with 3D neural networks*, Nature 619, 533–538.
  * *Usage:* Benchmarking fast 3D Earth-specific transformer rollouts and medium-range pressure level skill.
  * *Link:* https://doi.org/10.1038/s41586-023-06185-3

* **FourCastNet (NVIDIA)**
  * *Reference:* Pathak et al. (2022), *FourCastNet: A Global Data-driven High-resolution Weather Model using Adaptive Fourier Neural Operators*, arXiv:2202.11214.
  * *Usage:* Reference model for ultra-fast, sub-second 0.25° global atmospheric rollouts via AFNO.
  * *Link:* https://arxiv.org/abs/2202.11214

* **Bayesian Model Averaging (BMA Theory)**
  * *Reference:* Raftery et al. (2005), *Using Bayesian Model Averaging to Calibrate Forecast Ensembles*, Monthly Weather Review 133, 1155–1174.
  * *Usage:* The core statistical theory powering the dynamic multi-model ensemble weighting and probability density calibration.
  * *Link:* https://doi.org/10.1175/MWR2906.1

### Operational Data & Ground Truth
* **ECMWF Open Data & AIFS**
  * *Usage:* Physical NWP ground truth (IFS) and operational AI forecasting (AIFS) data streams.
  * *Link:* https://www.ecmwf.int/en/forecasts/datasets/open-data

* **ERA5 Global Climate Reanalysis**
  * *Usage:* Ground truth verification dataset used to calculate historical model skill metrics (RMSE, MAE, CRPS) and train adaptive weight gates.
  * *Link:* https://cds.climate.copernicus.eu

* **NOAA GFS & Open-Meteo API**
  * *Usage:* Live real-time API backend fetching global grid telemetry, surface pressure, wind vectors, and dynamic weather codes.
  * *Link:* https://open-meteo.com

* **NASA GPM IMERG**
  * *Usage:* High-resolution calibrated satellite precipitation data used to benchmark real-time rainfall accuracy and convective storm alerts.
  * *Link:* https://gpm.nasa.gov/data/imerg

* **WMO Standard 4678**
  * *Usage:* The World Meteorological Organization code-table logic translating raw numeric weather codes into human-readable UI states and atmospheric triggers.
  * *Link:* https://www.wmo.int
