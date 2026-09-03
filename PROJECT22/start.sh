#!/bin/bash

# Dynamic AI-NWP Weather Blending Platform - Quick Start Script
set -e

echo "=========================================="
echo " Dynamic AI-NWP Weather Blending Platform"
echo "=========================================="

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create data directories
echo "Creating data directories..."
mkdir -p data/raw data/blended data/metrics

# Copy environment file if not exists
if [ ! -f backend/.env ]; then
    echo "Creating .env file from template..."
    cp backend/.env.example backend/.env
fi

echo ""
echo "Starting services with Docker Compose..."
echo ""

# Start all services
docker-compose up -d

echo ""
echo "Waiting for services to start..."
sleep 10

# Check if services are running
echo ""
echo "Checking service status..."
docker-compose ps

echo ""
echo "=========================================="
echo " Setup Complete!"
echo "=========================================="
echo ""
echo " Services:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo "   MinIO:     http://localhost:9001"
echo ""
echo " Default credentials:"
echo "   MinIO: minioadmin / minioadmin"
echo "   PostgreSQL: weather / weather123"
echo ""
echo " To stop services: docker-compose down"
echo " To view logs: docker-compose logs -f"
echo "=========================================="
