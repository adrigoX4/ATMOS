from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool, QueuePool
from contextlib import contextmanager
from app.core.config import get_settings
from pathlib import Path

settings = get_settings()

# Ensure data directory exists for SQLite
Path(settings.DATA_DIR).mkdir(parents=True, exist_ok=True)

# Connection configuration
connect_args = {}
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if is_sqlite:
    connect_args["check_same_thread"] = False
    # SQLite works best with NullPool in multi-threaded FastAPI to prevent QueuePool exhaustion
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        poolclass=NullPool,
    )
else:
    # PostgreSQL / MySQL configuration with generous pool & auto-recycle
    engine = create_engine(
        settings.DATABASE_URL,
        poolclass=QueuePool,
        pool_size=20,
        max_overflow=30,
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI route dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """Context manager for background workers and standalone scripts."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()