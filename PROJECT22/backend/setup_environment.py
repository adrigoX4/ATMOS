#!/usr/bin/env python3
"""
Setup script to install all dependencies and configure the backend environment.
Run this script to set up the project: python setup_environment.py
"""

import subprocess
import sys
import os
from pathlib import Path


class EnvironmentSetup:
    """Handle environment setup and dependency installation."""

    def __init__(self):
        self.project_root = Path(__file__).parent
        self.requirements_file = self.project_root / "requirements.txt"
        self.env_file = self.project_root / ".env"

    def print_header(self, message: str):
        """Print formatted header."""
        print("\n" + "=" * 60)
        print(f"  {message}")
        print("=" * 60 + "\n")

    def print_success(self, message: str):
        """Print success message."""
        print(f"✅ {message}")

    def print_error(self, message: str):
        """Print error message."""
        print(f"❌ {message}")

    def print_info(self, message: str):
        """Print info message."""
        print(f"ℹ️  {message}")

    def check_python_version(self):
        """Check if Python version is compatible."""
        self.print_header("Checking Python Version")
        
        version_info = sys.version_info
        python_version = f"{version_info.major}.{version_info.minor}.{version_info.micro}"
        
        print(f"Current Python: {python_version}")
        
        if version_info.major < 3 or (version_info.major == 3 and version_info.minor < 9):
            self.print_error("Python 3.9+ is required!")
            sys.exit(1)
        
        self.print_success(f"Python {python_version} is compatible")

    def check_requirements_file(self):
        """Check if requirements.txt exists."""
        self.print_header("Checking Requirements File")
        
        if not self.requirements_file.exists():
            self.print_error(f"requirements.txt not found at {self.requirements_file}")
            sys.exit(1)
        
        self.print_success(f"Found requirements.txt at {self.requirements_file}")
        
        # Show requirements count
        with open(self.requirements_file) as f:
            packages = [line.strip() for line in f if line.strip() and not line.startswith("#")]
        
        self.print_info(f"Total packages to install: {len(packages)}")

    def upgrade_pip(self):
        """Upgrade pip to latest version."""
        self.print_header("Upgrading pip")
        
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "--upgrade", "pip"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            self.print_success("pip upgraded successfully")
        except subprocess.CalledProcessError as e:
            self.print_error(f"Failed to upgrade pip: {e}")
            # Continue anyway as it's not critical

    def install_requirements(self):
        """Install all requirements from requirements.txt."""
        self.print_header("Installing Dependencies")
        
        try:
            print(f"Installing from: {self.requirements_file}\n")
            
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "-r", str(self.requirements_file)]
            )
            
            self.print_success("All dependencies installed successfully!")
            
        except subprocess.CalledProcessError as e:
            self.print_error(f"Failed to install dependencies: {e}")
            self.print_info("Attempting to install packages individually...")
            self.install_requirements_individually()

    def install_requirements_individually(self):
        """Install requirements one by one if batch install fails."""
        self.print_header("Installing Packages Individually")
        
        with open(self.requirements_file) as f:
            packages = [line.strip() for line in f if line.strip() and not line.startswith("#")]
        
        failed_packages = []
        
        for i, package in enumerate(packages, 1):
            print(f"\n[{i}/{len(packages)}] Installing {package}...")
            
            try:
                subprocess.check_call(
                    [sys.executable, "-m", "pip", "install", package],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
                self.print_success(f"Installed: {package}")
                
            except subprocess.CalledProcessError:
                self.print_error(f"Failed to install: {package}")
                failed_packages.append(package)
        
        if failed_packages:
            self.print_header("Summary - Failed Packages")
            for package in failed_packages:
                print(f"  • {package}")
            self.print_info(f"\nTry installing these manually or check their documentation")
        else:
            self.print_success("All packages installed successfully!")

    def create_env_file(self):
        """Create .env file if it doesn't exist."""
        self.print_header("Creating Environment File")
        
        if self.env_file.exists():
            self.print_info(".env file already exists, skipping creation")
            return
        
        env_content = """# Environment Configuration
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
"""
        
        try:
            with open(self.env_file, "w") as f:
                f.write(env_content)
            self.print_success(f".env file created at {self.env_file}")
        except Exception as e:
            self.print_error(f"Failed to create .env file: {e}")

    def verify_imports(self):
        """Verify that main imports work."""
        self.print_header("Verifying Core Imports")
        
        critical_imports = [
            "fastapi",
            "uvicorn",
            "pydantic",
            "sqlalchemy",
            "redis",
            "celery",
        ]
        
        all_ok = True
        
        for package in critical_imports:
            try:
                __import__(package)
                self.print_success(f"Successfully imported: {package}")
            except ImportError as e:
                self.print_error(f"Failed to import: {package} - {e}")
                all_ok = False
        
        return all_ok

    def print_next_steps(self):
        """Print next steps after setup."""
        self.print_header("Next Steps")
        
        print("""
1. Start the backend services:
   docker-compose up

2. Or run individual services:
   
   a) Database (PostgreSQL):
      docker run -d --name weather_postgres \\
        -e POSTGRES_USER=weather \\
        -e POSTGRES_PASSWORD=weather123 \\
        -e POSTGRES_DB=weather_blending \\
        -p 5432:5432 postgis/postgis:16-3.4

   b) Redis:
      docker run -d --name weather_redis \\
        -p 6379:6379 redis:7-alpine

   c) MinIO:
      docker run -d --name weather_minio \\
        -p 9000:9000 -p 9001:9001 \\
        -e MINIO_ROOT_USER=minioadmin \\
        -e MINIO_ROOT_PASSWORD=minioadmin \\
        minio/minio:latest server /data

3. Run the backend:
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

4. Access API documentation:
   http://localhost:8000/docs

5. Run frontend (in another terminal):
   cd ../frontend
   npm install
   npm run dev
        """)

    def run_setup(self):
        """Run the complete setup process."""
        self.print_header("🚀 Backend Environment Setup")
        
        try:
            self.check_python_version()
            self.check_requirements_file()
            self.upgrade_pip()
            self.install_requirements()
            self.create_env_file()
            
            # Verify imports
            if self.verify_imports():
                self.print_success("All core modules imported successfully!")
            else:
                self.print_info("Some modules failed to import. They may install with docker.")
            
            self.print_next_steps()
            
            self.print_header("✨ Setup Complete!")
            print("Your backend environment is ready to use!\n")
            
        except KeyboardInterrupt:
            print("\n⚠️  Setup interrupted by user")
            sys.exit(1)
        except Exception as e:
            self.print_error(f"Unexpected error: {e}")
            sys.exit(1)


if __name__ == "__main__":
    setup = EnvironmentSetup()
    setup.run_setup()
