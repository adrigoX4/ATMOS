CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;

-- Forecast runs table
CREATE TABLE IF NOT EXISTS forecast_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(50) NOT NULL,
    init_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    storage_path VARCHAR(255) NOT NULL,
    file_format VARCHAR(10) DEFAULT 'zarr',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_forecast_runs_model ON forecast_runs(model_name);
CREATE INDEX idx_forecast_runs_status ON forecast_runs(status);

-- Model skill metrics table
CREATE TABLE IF NOT EXISTS model_skill_metrics (
    metric_id BIGSERIAL PRIMARY KEY,
    run_id UUID REFERENCES forecast_runs(run_id),
    model_name VARCHAR(50) NOT NULL,
    variable_name VARCHAR(30) NOT NULL,
    lead_time_hours INT NOT NULL,
    season VARCHAR(20) NOT NULL,
    rmse_score FLOAT NOT NULL,
    crps_score FLOAT,
    mae_score FLOAT,
    bias_score FLOAT,
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_skill_model_lead ON model_skill_metrics(model_name, lead_time_hours, season);

-- Blend results table
CREATE TABLE IF NOT EXISTS blend_results (
    blend_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES forecast_runs(run_id),
    variable_name VARCHAR(30) NOT NULL,
    lead_time_hours INT NOT NULL,
    init_time TIMESTAMPTZ NOT NULL,
    storage_path VARCHAR(255) NOT NULL,
    weight_map_path VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blend_results_run ON blend_results(run_id);

-- Extreme weather alerts table
CREATE TABLE IF NOT EXISTS extreme_weather_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blend_id UUID REFERENCES blend_results(blend_id),
    alert_type VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    region_name VARCHAR(100),
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    threshold_value FLOAT NOT NULL,
    actual_value FLOAT NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_type ON extreme_weather_alerts(alert_type);
CREATE INDEX idx_alerts_severity ON extreme_weather_alerts(severity);
