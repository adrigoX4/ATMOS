# 📦 Installation Quick Reference

## TL;DR - Just Run This

### macOS/Linux
```bash
cd backend
python3 setup_environment.py
```

### Windows (PowerShell)
```powershell
cd backend
python setup_environment.py
```

---

## What Gets Installed?

### Essential (Always Installed)
- **FastAPI** - Web framework
- **Uvicorn** - ASGI server
- **Pydantic** - Data validation
- **SQLAlchemy** - Database ORM
- **Redis** - Caching client
- **Celery** - Task queue

### Full Installation (Also Installed)
- Machine Learning: PyTorch, XGBoost, Scikit-Learn
- GIS: Rasterio, GeoPandas, Shapely
- Data: NumPy, Pandas, xarray
- Storage: MinIO, boto3
- Earth Engine: earthengine-api

---

## Installation Options

| Method | Command | Time | Use Case |
|--------|---------|------|----------|
| **Python Script** | `python3 setup_environment.py` | 5-10 min | Recommended |
| **Shell Script** | `./setup.sh` | 5-10 min | macOS/Linux |
| **pip** | `pip install -r requirements.txt` | 5-10 min | Manual |
| **Docker** | `docker-compose up` | 10-15 min | Production |
| **Basic** | `pip install -r requirements-basic.txt` | 2-3 min | Testing |

---

## Verify Installation

```bash
# Test all imports
python3 backend/test_imports.py

# Run backend
cd backend
uvicorn app.main:app --reload

# Visit API docs
open http://localhost:8000/docs
```

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| `ModuleNotFoundError: fastapi` | `pip install fastapi uvicorn[standard]` |
| `Permission denied` | Use `pip install --user -r requirements.txt` |
| PostgreSQL driver error | `pip install psycopg2-binary` |
| Virtual environment issues | Create venv: `python3 -m venv .venv` |
| Dependency conflicts | Try: `pip install -r requirements-basic.txt` |

---

## What's Included

### Created Files
- ✅ `setup_environment.py` - Automated Python setup
- ✅ `setup.sh` - Automated shell setup
- ✅ `test_imports.py` - Verify installation
- ✅ `requirements-basic.txt` - Essential packages only
- ✅ `.env` - Environment configuration

### Modified Files
- ✅ `app/main.py` - Enhanced FastAPI app
- ✅ `docker-compose.yml` - Updated configuration

---

## Running the Backend

```bash
# Development (with auto-reload)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Production (multiple workers)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# With Celery
celery -A app.workers.celery_app worker --loglevel=info

# Using Docker
docker-compose up backend
```

---

## Environment Variables

File: `.env`

```
DEBUG=True
DATABASE_URL=postgresql+psycopg2://weather:weather123@localhost:5432/weather_blending
REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=localhost:9000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

## API Access

Once running, access:

| Resource | URL |
|----------|-----|
| Interactive Docs | http://localhost:8000/docs |
| Alternative Docs | http://localhost:8000/redoc |
| Health Check | http://localhost:8000/health |
| Root API | http://localhost:8000/ |

---

## Next Steps

1. ✅ Run setup script
2. ✅ Verify with `test_imports.py`
3. 🔄 Start backend with `uvicorn`
4. 🔄 Start frontend
5. 🔄 Access http://localhost:3000

---

**Need help?** Check `SETUP.md` for detailed guide
