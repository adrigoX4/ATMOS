import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class ForecastRun(Base):
    __tablename__ = "forecast_runs"

    run_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_name = Column(String(50), nullable=False, index=True)
    init_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="PENDING")
    storage_path = Column(String(255), nullable=False)
    file_format = Column(String(10), default="zarr")
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    skill_metrics = relationship("ModelSkillMetric", back_populates="forecast_run")
    blend_results = relationship("BlendResult", back_populates="forecast_run")


class ModelSkillMetric(Base):
    __tablename__ = "model_skill_metrics"

    metric_id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(UUID(as_uuid=True), ForeignKey("forecast_runs.run_id"), nullable=False)
    model_name = Column(String(50), nullable=False, index=True)
    variable_name = Column(String(30), nullable=False)
    lead_time_hours = Column(Integer, nullable=False)
    season = Column(String(20), nullable=False)
    rmse_score = Column(Float, nullable=False)
    crps_score = Column(Float, nullable=True)
    mae_score = Column(Float, nullable=True)
    bias_score = Column(Float, nullable=True)
    computed_at = Column(DateTime, default=datetime.utcnow)

    forecast_run = relationship("ForecastRun", back_populates="skill_metrics")


class BlendResult(Base):
    __tablename__ = "blend_results"

    blend_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("forecast_runs.run_id"), nullable=False)
    variable_name = Column(String(30), nullable=False)
    lead_time_hours = Column(Integer, nullable=False)
    init_time = Column(DateTime(timezone=True), nullable=False)
    storage_path = Column(String(255), nullable=False)
    weight_map_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    forecast_run = relationship("ForecastRun", back_populates="blend_results")
    extreme_alerts = relationship("ExtremeWeatherAlert", back_populates="blend_result")


class ExtremeWeatherAlert(Base):
    __tablename__ = "extreme_weather_alerts"

    alert_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blend_id = Column(UUID(as_uuid=True), ForeignKey("blend_results.blend_id"), nullable=False)
    alert_type = Column(String(30), nullable=False)
    severity = Column(String(20), nullable=False)
    region_name = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    threshold_value = Column(Float, nullable=False)
    actual_value = Column(Float, nullable=False)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    blend_result = relationship("BlendResult", back_populates="extreme_alerts")
