# 🚀 Backend Setup Guide

Complete guide to install and configure the backend environment.

## Quick Start (One Command)

### Option 1: Using Python Setup Script (Recommended)
```bash
cd backend
python3 setup_environment.py
```

### Option 2: Using Shell Script (macOS/Linux)
```bash
cd backend
chmod +x setup.sh
./setup.sh
```

### Option 3: Using pip directly
```bash
cd backend
pip install -r requirements.txt
```

---

## Installation Methods

### Method 1: Full Installation (Recommended for Production)

Install all dependencies including ML/GIS libraries:

```bash
cd /Users/vedangsharma/Desktop/PROJECT22/backend
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

**Time**: ~5-10 minutes (depending on internet)

**Packages included**:
- FastAPI, Uvicorn, Pydantic
- PostgreSQL, Redis, MinIO clients
- Machine Learning: PyTorch, XGBoost, scikit-learn
- GIS: Rasterio, GeoPandas, Geopandas
- Earth Engine API
- Celery for async tasks

---

### Method 2: Basic Installation (For Testing)

Install only essential packages:

```bash
cd /Users/vedangsharma/Desktop/PROJECT22/backend
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements-basic.txt
```

**Time**: ~2-3 minutes

**Packages included**:
- FastAPI stack
- Database & caching
- Basic data processing
- Task queue

---

### Method 3: Docker (Recommended for Production)

Use Docker to run everything in containers:

```bash
cd /Users/vedangsharma/Desktop/PROJECT22
docker-compose up
```

This automatically installs everything in isolated containers.

---

## Verification

### Check Python Version
```bash
python3 --version  # Should be 3.9+
```

### Verify Core Imports
```bash
python3 << 'EOF'
import fastapi
import uvicorn
import sqlalchemy
import redis
import celery
print("✅ All core packages installed!")
EOF
```

### Test Backend Start
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Then visit: http://localhost:8000/docs

---

## Environment Setup

### Create .env File
The setup scripts automatically create `.env`, but you can do it manually:

```bash
cd backend
cat > .env << 'EOF'
DEBUG=True
API_PREFIX=/api/v1
DATABASE_URL=postgresql+psycopg2://weather:weather123@localhost:5432/weather_blending
REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=weather-forecasts
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
LOG_LEVEL=INFO
EOF
```

### Load Environment Variables
```bash
cd backend
export $(cat .env | xargs)
```

---

## Dependency Groups

### Core API Stack
```bash
pip install fastapi uvicorn[standard] pydantic python-dotenv
```

### Database
```bash
pip install sqlalchemy psycopg2-binary alembic geoalchemy2
```

### Caching & Tasks
```bash
pip install redis celery[redis]
```

### Storage
```bash
pip install minio boto3
```

### Data Processing
```bash
pip install numpy pandas xarray scipy scikit-learn
```

### Machine Learning
```bash
pip install torch xgboost lightgbm optuna scikit-learn
```

### GIS & Export
```bash
pip install rasterio rioxarray geopandas shapely
```

### Earth Engine
```bash
pip install earthengine-api
```

---

## Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'fastapi'"

**Solution**: Install missing packages
```bash
python3 -m pip install fastapi uvicorn[standard]
```

### Issue: PostgreSQL driver not found

**Solution**: Install psycopg2
```bash
pip install psycopg2-binary
```

On macOS with Apple Silicon, you might need:
```bash
pip install --no-binary :all: psycopg2-binary
```

### Issue: Permission Denied Error

**Solution**: Use `--user` flag
```bash
pip install --user -r requirements.txt
```

### Issue: Using Virtual Environment

**Solution**: Create and activate venv first
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Issue: Dependency Conflicts

**Solution**: Install basic requirements first
```bash
pip install -r requirements-basic.txt
```

Then add additional packages individually:
```bash
pip install torch xgboost rasterio earthengine-api
```

---

## Running the Backend

### Development Mode
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Production Mode
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### With Docker
```bash
docker-compose up backend
```

### With Celery Worker
```bash
# Terminal 1 - Backend
celery -A app.workers.celery_app worker --loglevel=info

# Terminal 2 - API Server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## API Access

Once backend is running:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health
- **Root**: http://localhost:8000/

---

## Database Setup

### Create Database (PostgreSQL)

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE weather_blending;
CREATE USER weather WITH PASSWORD 'weather123';
GRANT ALL PRIVILEGES ON DATABASE weather_blending TO weather;
\q
```

### Run Migrations
```bash
cd backend
alembic upgrade head
```

---

## File Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application
│   ├── core/
│   │   ├── config.py        # Settings
│   │   ├── database.py      # Database setup
│   │   └── rate_limiter.py  # Rate limiting
│   ├── api/
│   │   ├── endpoints.py     # API routes
│   │   └── websocket.py     # WebSocket handler
│   ├── models/              # Database models
│   ├── blending/            # ML blending engine
│   └── workers/             # Celery tasks
├── requirements.txt         # All dependencies
├── requirements-basic.txt   # Essential dependencies
├── setup_environment.py     # Python setup script
├── setup.sh                 # Shell setup script
├── .env                     # Environment variables
└── Dockerfile              # Docker configuration
```

---

## Next Steps

1. ✅ Install dependencies
2. ✅ Create `.env` file
3. ✅ Set up database
4. 🔄 Start backend server
5. 🔄 Start frontend server
6. 🔄 Access http://localhost:3000

---

## Support

If you encounter issues:

1. Check error messages carefully
2. Try the basic installation first
3. Use Docker if native installation fails
4. Check Python version (must be 3.9+)
5. Ensure all services (PostgreSQL, Redis, MinIO) are running

For detailed logs:
```bash
tail -f logs/backend.log
```

---

**Last Updated**: 2026-09-03
**Version**: 1.0.0
