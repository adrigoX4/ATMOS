#!/usr/bin/env python3
"""
Test script to verify all imports work correctly.
Run this to check if backend dependencies are installed properly.
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))


def test_import(module_name: str, package_name: str = None) -> bool:
    """Test if a module can be imported."""
    package = package_name or module_name
    try:
        __import__(module_name)
        print(f"  ✅ {package:<30} OK")
        return True
    except ImportError as e:
        print(f"  ❌ {package:<30} FAILED - {str(e)[:40]}")
        return False


def main():
    """Run all import tests."""
    
    print("=" * 70)
    print("  Backend Import Test")
    print("=" * 70)
    print()
    
    print("Python Information:")
    print(f"  Version: {sys.version}")
    print(f"  Path: {sys.executable}")
    print()
    
    # Test core imports
    print("Core API Packages:")
    core_imports = [
        ("fastapi", "FastAPI"),
        ("uvicorn", "Uvicorn"),
        ("pydantic", "Pydantic"),
        ("pydantic_settings", "Pydantic Settings"),
        ("python_dotenv", "Python Dotenv"),
    ]
    core_ok = all(test_import(mod, name) for mod, name in core_imports)
    print()
    
    # Test database imports
    print("Database Packages:")
    db_imports = [
        ("sqlalchemy", "SQLAlchemy"),
        ("psycopg2", "PostgreSQL Driver"),
        ("alembic", "Alembic"),
    ]
    db_ok = all(test_import(mod, name) for mod, name in db_imports)
    print()
    
    # Test caching imports
    print("Caching & Queue Packages:")
    cache_imports = [
        ("redis", "Redis"),
        ("celery", "Celery"),
    ]
    cache_ok = all(test_import(mod, name) for mod, name in cache_imports)
    print()
    
    # Test storage imports
    print("Storage Packages:")
    storage_imports = [
        ("minio", "MinIO"),
        ("boto3", "AWS S3"),
    ]
    storage_ok = all(test_import(mod, name) for mod, name in storage_imports)
    print()
    
    # Test data processing imports
    print("Data Processing Packages:")
    data_imports = [
        ("numpy", "NumPy"),
        ("pandas", "Pandas"),
        ("xarray", "xarray"),
        ("scipy", "SciPy"),
    ]
    data_ok = all(test_import(mod, name) for mod, name in data_imports)
    print()
    
    # Test ML imports
    print("Machine Learning Packages:")
    ml_imports = [
        ("sklearn", "Scikit-Learn"),
        ("xgboost", "XGBoost"),
        ("torch", "PyTorch"),
    ]
    ml_ok = all(test_import(mod, name) for mod, name in ml_imports)
    print()
    
    # Test GIS imports
    print("GIS & Export Packages:")
    gis_imports = [
        ("rasterio", "Rasterio"),
        ("geopandas", "GeoPandas"),
        ("shapely", "Shapely"),
    ]
    gis_ok = all(test_import(mod, name) for mod, name in gis_imports)
    print()
    
    # Test Earth Engine
    print("Earth Engine Packages:")
    ee_imports = [
        ("ee", "Earth Engine API"),
    ]
    ee_ok = all(test_import(mod, name) for mod, name in ee_imports)
    print()
    
    # Test local imports
    print("Local Application Modules:")
    print()
    
    try:
        from app.core.config import get_settings
        print("  ✅ app.core.config               OK")
        config_ok = True
    except ImportError as e:
        print(f"  ❌ app.core.config               FAILED - {str(e)[:40]}")
        config_ok = False
    
    try:
        from app.api.endpoints import router
        print("  ✅ app.api.endpoints             OK")
        endpoints_ok = True
    except ImportError as e:
        print(f"  ❌ app.api.endpoints             FAILED - {str(e)[:40]}")
        endpoints_ok = False
    
    try:
        from app.api.websocket import websocket_endpoint
        print("  ✅ app.api.websocket             OK")
        websocket_ok = True
    except ImportError as e:
        print(f"  ❌ app.api.websocket             FAILED - {str(e)[:40]}")
        websocket_ok = False
    
    try:
        from app.models.models import ForecastRun
        print("  ✅ app.models.models             OK")
        models_ok = True
    except ImportError as e:
        print(f"  ❌ app.models.models             FAILED - {str(e)[:40]}")
        models_ok = False
    
    try:
        from app.workers.celery_app import app as celery_app
        print("  ✅ app.workers.celery_app        OK")
        celery_app_ok = True
    except ImportError as e:
        print(f"  ❌ app.workers.celery_app        FAILED - {str(e)[:40]}")
        celery_app_ok = False
    
    print()
    
    # Test main app
    print("Testing Main Application:")
    print()
    
    try:
        from app.main import app
        print("  ✅ FastAPI app created           OK")
        app_ok = True
    except ImportError as e:
        print(f"  ❌ FastAPI app creation          FAILED - {str(e)[:40]}")
        app_ok = False
    
    print()
    print("=" * 70)
    
    # Summary
    all_core = core_ok and db_ok and cache_ok and storage_ok
    all_app = config_ok and endpoints_ok and websocket_ok and models_ok and app_ok
    
    print("Summary:")
    print()
    
    status_text = "✅ READY TO RUN" if (all_core and all_app) else "⚠️  PARTIAL SETUP"
    print(f"  {status_text}")
    print()
    
    if all_core:
        print("  ✅ Core packages: INSTALLED")
    else:
        print("  ❌ Core packages: MISSING")
    
    if all_app:
        print("  ✅ Application modules: READY")
    else:
        print("  ⚠️  Application modules: CHECK ERRORS")
    
    if core_ok and db_ok and cache_ok:
        print("  ✅ Essential services: AVAILABLE")
    else:
        print("  ⚠️  Some services: UNAVAILABLE")
    
    if ml_ok and gis_ok:
        print("  ✅ ML & GIS packages: AVAILABLE")
    else:
        print("  ⚠️  ML & GIS packages: NOT INSTALLED (optional)")
    
    print()
    
    if all_core and all_app:
        print("🎉 Backend is ready! Run with:")
        print("   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload")
        return 0
    else:
        print("⚠️  Some packages are missing. Run:")
        print("   python3 setup_environment.py")
        print("   or")
        print("   pip install -r requirements.txt")
        return 1


if __name__ == "__main__":
    sys.exit(main())
