@echo off
echo ==========================================
echo  ATMOS Frontend
echo ==========================================
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo Starting frontend...
echo Dashboard will be available at http://localhost:3000
echo.
call npm start
