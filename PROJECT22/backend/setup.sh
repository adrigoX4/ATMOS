#!/bin/bash

# Backend Setup Script for macOS/Linux
# This script installs all dependencies and sets up the environment

echo "=================================="
echo "  Backend Environment Setup"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Python is installed
echo -e "${BLUE}Checking Python installation...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 is not installed${NC}"
    echo "Install Python 3.9+ from https://www.python.org/"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "${GREEN}✅ Found Python ${PYTHON_VERSION}${NC}"
echo ""

# Navigate to backend directory
echo -e "${BLUE}Navigating to backend directory...${NC}"
cd "$(dirname "$0")" || exit
echo -e "${GREEN}✅ Current directory: $(pwd)${NC}"
echo ""

# Check if requirements.txt exists
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}❌ requirements.txt not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Found requirements.txt${NC}"
echo ""

# Upgrade pip
echo -e "${BLUE}Upgrading pip...${NC}"
python3 -m pip install --upgrade pip > /dev/null 2>&1
echo -e "${GREEN}✅ pip upgraded${NC}"
echo ""

# Install requirements
echo -e "${BLUE}Installing all dependencies...${NC}"
echo "This may take a few minutes..."
echo ""

if python3 -m pip install -r requirements.txt; then
    echo ""
    echo -e "${GREEN}✅ All dependencies installed successfully!${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  Some packages failed to install${NC}"
    echo "Trying individual installation..."
    
    while IFS= read -r package; do
        # Skip comments and empty lines
        [[ "$package" =~ ^#.*$ ]] && continue
        [[ -z "$package" ]] && continue
        
        echo -ne "${BLUE}Installing: $package${NC}... "
        if python3 -m pip install "$package" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
        fi
    done < requirements.txt
fi

echo ""

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${BLUE}Creating .env file...${NC}"
    cat > .env << 'EOF'
# Environment Configuration
DEBUG=True
API_PREFIX=/api/v1

# Database
DATABASE_URL=postgresql+psycopg2://weather:weather123@localhost:5432/weather_blending

# Redis
REDIS_URL=redis://localhost:6379/0

# MinIO Storage
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=weather-forecasts

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000

# Logging
LOG_LEVEL=INFO
EOF
    echo -e "${GREEN}✅ .env file created${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

echo ""

# Verify critical imports
echo -e "${BLUE}Verifying critical imports...${NC}"

python3 << 'PYTHON_VERIFY'
import sys
critical_packages = ["fastapi", "uvicorn", "pydantic", "sqlalchemy", "redis"]
failed = []

for package in critical_packages:
    try:
        __import__(package)
        print(f"  ✓ {package}")
    except ImportError:
        print(f"  ✗ {package}")
        failed.append(package)

if failed:
    print(f"\n⚠️  Some packages may need docker: {', '.join(failed)}")
else:
    print("\n✅ All critical packages verified!")
PYTHON_VERIFY

echo ""
echo "=================================="
echo "  🎉 Setup Complete!"
echo "=================================="
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Start services with Docker:"
echo "   docker-compose up"
echo ""
echo "2. Or run the backend directly:"
echo "   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo ""
echo "3. Access API docs:"
echo "   http://localhost:8000/docs"
echo ""
