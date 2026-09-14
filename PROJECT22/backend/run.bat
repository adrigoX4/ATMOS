@echo off
echo ==========================================
echo  AI-NWP Weather Blending Platform
echo ==========================================
echo.

REM Create data directories
if not exist "data" mkdir data
if not exist "data\raw" mkdir data\raw
if not exist "data\storage" mkdir data\storage
if not exist "data\blended" mkdir data\blended
if not exist "data\metrics" mkdir data\metrics
if not exist "data\geotiff" mkdir data\geotiff

REM Create venv if missing
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

REM Activate and install
call .venv\Scripts\activate
echo Installing dependencies...
pip install -r requirements.txt -q

echo.
echo Starting backend server...
echo API docs will be available at http://localhost:8000/docs
echo.
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
