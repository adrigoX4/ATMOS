# Dynamic AI-NWP Weather Blending Platform

A production-grade system for dynamically blending Numerical Weather Prediction (NWP) models with AI-based weather forecasts, providing adaptive weight computation, extreme event detection, and an interactive GIS dashboard.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INPUT SOURCES (FTP/HTTP APIs)                    │
│          ECMWF HRES, GFS, NCUM, GraphCast, Pangu-Weather          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│              INGESTION & DATA VALIDATION WORKERS                   │
│           Python / cfgrib / Celery Async Ingestion Pool            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         STORAGE LAYER                              │
│  - Object Store: MinIO (Raw GRIB2 & Chunked Zarr)                 │
│  - Relational DB: PostgreSQL + PostGIS (Metadata, Audit)          │
│  - Cache & Queue: Redis (Task Broker & Pub/Sub)                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│              COMPUTE ENGINE (Dask Distributed Cluster)             │
│  1. Spatial Regridding (CDO / PyResample to 0.25°)                │
│  2. Error Covariance & Spatial Variance Estimation                │
│  3. Dynamic Weight Tensor Matrix Calculation                       │
│  4. Quantile Loss XGBoost Blending & EWGI Scoring                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API & TILING SERVICE                         │
│         FastAPI Server + GDAL / Tippecanoe + Vector Tile Pool     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND CLIENT INTERFACE                       │
│       React 19 + MapLibre GL / Deck.gl (WebGL Deck Canvas)        │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Backend
- **Python 3.11+** - Core language
- **FastAPI** - High-performance async API framework
- **Celery + Redis** - Distributed task queue for async processing
- **PostgreSQL + PostGIS** - Spatial database for metadata and alerts
- **MinIO** - S3-compatible object storage for gridded data
- **Xarray + Dask** - Multi-dimensional array processing
- **XGBoost + PyTorch** - Machine learning meta-learners

### Frontend
- **React 18+** - UI framework
- **Deck.gl** - WebGL-accelerated geospatial visualization
- **MapLibre GL** - Interactive map rendering
- **Tailwind CSS** - Utility-first styling

## Project Structure

```
weather-blending-platform/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints.py      # FastAPI route handlers
│   │   ├── core/
│   │   │   ├── config.py         # Application settings
│   │   │   └── database.py       # Database connection
│   │   ├── ingestion/
│   │   │   └── data_ingestion.py # Model data ingestion
│   │   ├── blending/
│   │   │   └── engine.py         # Core blending algorithm
│   │   ├── storage/
│   │   │   └── minio_service.py  # Object storage service
│   │   ├── models/
│   │   │   └── models.py         # SQLAlchemy models
│   │   └── main.py               # FastAPI application
│   ├── workers/
│   │   ├── celery_app.py         # Celery configuration
│   │   └── tasks.py              # Async task definitions
│   ├── scripts/
│   │   └── setup.py              # Setup and initialization
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── map/
│   │   │   │   └── WeatherMap.tsx    # Deck.gl map
│   │   │   ├── weather/
│   │   │   │   ├── WeatherCard.tsx
│   │   │   │   └── HourlyForecast.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── ModelWeights.tsx
│   │   │   │   └── MetricCharts.tsx
│   │   │   └── alerts/
│   │   │       └── ExtremeAlerts.tsx
│   │   ├── services/
│   │   │   └── api.ts            # API client
│   │   └── utils/
│   │       └── types.ts          # TypeScript types
│   └── package.json
├── postgresql/
│   └── init.sql                  # Database initialization
├── docker-compose.yml            # Container orchestration
└── README.md
```

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Python 3.11+
- Node.js 18+

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd weather-blending-platform

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
# MinIO Console: http://localhost:9001
```

### Option 2: Manual Setup

```bash
# Backend setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL, Redis, and MinIO (or use Docker)
docker-compose up -d postgres redis minio

# Initialize database and create sample data
python scripts/setup.py

# Start the backend server
uvicorn app.main:app --reload --port 8000

# Start Celery worker
celery -A workers.celery_app worker --loglevel=info

# Start Celery beat (scheduler)
celery -A workers.celery_app beat --loglevel=info

# Frontend setup
cd ../frontend
npm install
npm start
```

## API Endpoints

### Forecast Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/forecast/point` | Get point forecast with model weights |
| GET | `/api/v1/forecast/grid` | Get grid-based blended forecast |
| GET | `/api/v1/weights` | Get model weight distribution map |

### Alert Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/alerts/extreme` | Get extreme weather alerts |

### Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/runs` | List all forecast runs |
| GET | `/api/v1/metrics/{model}` | Get model verification metrics |

## Blending Algorithm

The system implements a two-stage adaptive weighting approach:

### Stage 1: Inverse Error Variance

```python
w_m(x,y,t,v) = (1/MSE_m)^γ / Σ(1/MSE_m)^γ
```

Where:
- `w_m` = weight for model m
- `MSE_m` = Mean Squared Error for model m
- `γ` = sharpening exponent (default: 2.0)

### Stage 2: XGBoost Meta-Learner

Uses gradient boosting to learn optimal weight combinations based on:
- Model forecasts at each grid point
- Historical verification against observations
- Spatial and temporal features

## Extreme Weather Thresholds (IMD Standards)

| Event Type | Threshold |
|------------|-----------|
| Extreme Rainfall | > 115.5 mm/day |
| Heavy Rainfall | > 64.5 mm/day |
| Heatwave | > 40°C |
| Severe Wind | > 60 km/h |

## Development

### Running Tests

```bash
# Backend tests
cd backend
pytest tests/

# Frontend tests
cd frontend
npm test
```

### Adding a New Model

1. Add model configuration to `DataIngestionService.MODEL_SOURCES`
2. Implement data parsing in `ingest_grib_file` or `ingest_netcdf_file`
3. The blending engine will automatically include the new model

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+psycopg2://weather:weather123@localhost:5432/weather_blending` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `MINIO_ENDPOINT` | `localhost:9000` | MinIO endpoint |
| `MINIO_BUCKET` | `weather-forecasts` | MinIO bucket name |

### Blending Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `DEFAULT_LOOKBACK` | 30 | Temporal window for error calculation |
| `GAMMA` | 2.0 | Weight sharpening exponent |
| `EPSILON` | 1e-6 | Zero-division guard |

## License

MIT License - See LICENSE file for details.
