# ATMOS. Weather Blending Platform - Conversation Log

## Project Overview
- **Project Path:** `C:\Users\adars\OneDrive\Desktop\project 22\project22\PROJECT22`
- **SIH Problem Statement:** Dynamic AI-NWP Blending Framework
- **Stack:** Python 3.14.7 + React + SQLite + Open-Meteo API (no PostgreSQL, Redis, MinIO)
- **Backend:** `http://localhost:8000` (FastAPI + uvicorn)
- **Frontend:** `http://localhost:3000` (React + MapLibre)

---

## What Was Built

### System Architecture
```
Open-Meteo API (free, no key) → Backend (FastAPI) → SQLite + NetCDF
                         ↓
                   Smart Blending Engine
                   (region/season/lead-time/regime-aware)
                         ↓
                   Frontend (React + MapLibre)
                   (map, weights, metrics, alerts, models tabs)
```

### Models Connected (16 total)
**Deterministic (9):**
- GFS (NOAA) - `gfs_seamless`
- ECMWF IFS (ECMWF) - `ecmwf_ifs025`
- ICON (DWD) - `icon_seamless`
- **AIFS (ECMWF AI)** - `ecmwf_aifs025`
- **GraphCast (Google DeepMind AI)** - `gfs_graphcast025`
- UKMO (UK Met Office) - `ukmo_seamless`
- JMA (Japan) - `jma_seamless`
- MeteoFrance - `meteofrance_seamless`
- CMA (China) - `cma_grapes_global`

**Ensemble (7):**
- GEFS (31 members) - `gfs_seamless_eps`
- ECMWF EPS (51 members) - `ecmwf_ifs025`
- **AIFS EPS (51 members, AI)** - `ecmwf_aifs025`
- ICON EPS (40 members) - `icon_seamless_eps`
- **WeatherNext (64 members, AI)** - `weathernext2`
- UKMO EPS (18 members) - `ukmo_global_20km`
- GEM EPS (21 members) - `gem_global`

### Smart Blending Engine
- **Region-aware:** 8 Indian regions (coastal_west, coastal_east, northern_plains, central_india, south_peninsular, northeast, western_ghats, thar_desert)
- **Season-aware:** winter, pre_monsoon, monsoon, post_monsoon
- **Lead-time adaptive:** weights degrade differently per model (0h to 168h)
- **Weather regime-aware:** cyclone, heavy_monsoon, heatwave, cold_wave, normal
- **AI model bonus:** AIFS/GraphCast get extra weight during extreme events

### Extreme Weather Detection (IMD Criteria)
- Heavy rain: 64.5mm, 115.5mm, 200mm, 300mm thresholds
- Heat wave: 40°C, 45°C (severe)
- Cold wave: 5°C, 0°C (severe)
- High wind: 40/60/90/120 km/h thresholds
- Model agreement-based severity scoring (EXTREME/SEVERE/MODERATE/LOW)

---

## Files Modified

### Backend
| File | Changes |
|------|---------|
| `backend/app/ingestion/open_meteo_service.py` | Expanded from 3 to 16 models, added ensemble fetching, AI models, denser India grid (2° spacing), key cities list |
| `backend/app/blending/smart_blending.py` | **NEW** - Region/season/lead-time/regime-aware weights, extreme event detection with model agreement |
| `backend/app/workers/tasks.py` | Full pipeline rewrite using smart blending, regime detection, lead-time adaptive weights |
| `backend/app/api/endpoints.py` | Added `/models/info`, `/regime`, `/forecast/point/multi-source` endpoints, updated weights endpoint with regime/season/region |
| `backend/app/main.py` | Runs `run_real_pipeline()` in background thread on startup |
| `backend/app/core/config.py` | SQLite settings, absolute paths |
| `backend/app/core/database.py` | SQLite with `check_same_thread=False` |
| `backend/app/models/models.py` | String PK models |
| `backend/app/storage/minio_service.py` | Local filesystem + NetCDF storage |

### Frontend
| File | Changes |
|------|---------|
| `frontend/src/App.tsx` | Added `models` tab, ModelsPanel import |
| `frontend/src/components/Header.tsx` | Added "Models" tab with Layers icon |
| `frontend/src/components/dashboard/ModelsPanel.tsx` | **NEW** - Shows all 16 models with types, providers, AI badges, skill scores |
| `frontend/src/components/dashboard/ModelWeights.tsx` | Added regime/season/region/lead-time display, AI model colors, lead-time adaptive weight visualization |
| `frontend/src/components/dashboard/MetricCharts.tsx` | Added all 9 model colors, fixed bar CSS (flex-col instead of absolute positioning) |
| `frontend/src/services/api.ts` | Added `getModelInfo()`, `getWeatherRegime()`, `getMultiSourceForecast()` |
| `frontend/src/utils/types.ts` | Added `ModelInfo`, `WeatherRegime`, `MultiSourceForecast` types |
| `frontend/src/declarations.d.ts` | Module declaration for `react-map-gl/maplibre` |

---

## How to Run

### Start Backend
```powershell
cd "C:\Users\adars\OneDrive\Desktop\project 22\project22\PROJECT22\backend"
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Start Frontend
```powershell
cd "C:\Users\adars\OneDrive\Desktop\project 22\project22\PROJECT22\frontend"
npm start
```

### Pipeline Auto-Runs on Startup
- Fetches 9 deterministic models × 110 grid points across India (~5-10 min)
- Computes smart blending weights (region + season + regime aware)
- Detects extreme weather events with model agreement scoring
- Stores results in SQLite + NetCDF files
- Frontend auto-refreshes when pipeline completes

---

## API Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/health` | Health check |
| `GET /api/v1/models/info` | All 16 connected models with skills |
| `GET /api/v1/regime` | Current weather regime for a location |
| `GET /api/v1/forecast/point` | Blended forecast for a point |
| `GET /api/v1/forecast/point/multi-source` | Individual model forecasts for comparison |
| `GET /api/v1/forecast/grid` | Gridded blended forecast |
| `GET /api/v1/weights` | Model weights with regime/season/region |
| `GET /api/v1/metrics/{model_name}` | Per-model skill metrics |
| `GET /api/v1/alerts/extreme` | Extreme weather alerts |

---

## Dashboard Tabs
1. **Forecast Map** - Interactive MapLibre map with weather overlays
2. **Model Weights** - Regime/season/region/lead-time adaptive weights visualization
3. **Alerts** - Extreme weather alerts with severity and model agreement
4. **Metrics** - Per-model RMSE/MAE/BIAS bar charts across lead times
5. **Models** - All 16 connected models with types, providers, AI badges, skill scores

---

## Key Technical Decisions
- **Open-Meteo API:** Free, no key required, provides all NWP + AI models
- **SQLite + NetCDF:** Avoids PostgreSQL/Redis/MinIO dependency issues
- **OneDrive:** Causes file-locking with zarr v3, switched to NetCDF
- **deck.gl:** Removed due to dependency hell, replaced with MapLibre native layers
- **react-scripts 5.0.1:** Needs `ajv@8` to fix module issue
- **Inverse error variance:** Base blending method, enhanced with region/season/regime modifiers
- **AI model bonus:** AIFS/GraphCast get 5-12% extra weight depending on regime

---

## Current Status
- [x] Backend running on `http://localhost:8000` with real data
- [x] Frontend running on `http://localhost:3000` with all 5 tabs
- [x] 16 models connected (9 deterministic + 7 ensemble)
- [x] Smart blending engine with region/season/lead-time/regime awareness
- [x] Extreme weather detection with IMD criteria
- [x] AI models (AIFS, GraphCast, WeatherNext) integrated
- [x] Pipeline auto-runs on startup with background thread

## Known Issues
- Pipeline takes ~5-10 min on first startup (fetching 110 grid points)
- Some frontend ESLint warnings (unused vars) - cosmetic only
- Port 3000 may need TIME_WAIT cooldown on restart

## Next Steps (If Needed)
- Add XGBoost meta-learner for weight optimization
- Add more ensemble statistics visualization
- Add historical forecast verification endpoint
- Add GeoTIFF export for blended forecasts
- Add WebSocket for real-time pipeline progress updates
