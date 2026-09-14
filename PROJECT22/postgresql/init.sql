CREATE TABLE IF NOT EXISTS forecast_runs (
    run_id TEXT PRIMARY KEY,
    model_name VARCHAR(50) NOT NULL,
    init_time DATETIME NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    storage_path VARCHAR(255) NOT NULL,
    file_format VARCHAR(10) DEFAULT 'zarr',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_model ON forecast_runs(model_name);
CREATE INDEX IF NOT EXISTS idx_forecast_runs_status ON forecast_runs(status);

CREATE TABLE IF NOT EXISTS model_skill_metrics (
    metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT REFERENCES forecast_runs(run_id),
    model_name VARCHAR(50) NOT NULL,
    variable_name VARCHAR(30) NOT NULL,
    lead_time_hours INT NOT NULL,
    season VARCHAR(20) NOT NULL,
    rmse_score FLOAT NOT NULL,
    crps_score FLOAT,
    mae_score FLOAT,
    bias_score FLOAT,
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skill_model_lead ON model_skill_metrics(model_name, lead_time_hours, season);

CREATE TABLE IF NOT EXISTS blend_results (
    blend_id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES forecast_runs(run_id),
    variable_name VARCHAR(30) NOT NULL,
    lead_time_hours INT NOT NULL,
    init_time DATETIME NOT NULL,
    storage_path VARCHAR(255) NOT NULL,
    weight_map_path VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blend_results_run ON blend_results(run_id);

CREATE TABLE IF NOT EXISTS extreme_weather_alerts (
    alert_id TEXT PRIMARY KEY,
    blend_id TEXT REFERENCES blend_results(blend_id),
    alert_type VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    region_name VARCHAR(100),
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    threshold_value FLOAT NOT NULL,
    actual_value FLOAT NOT NULL,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_type ON extreme_weather_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON extreme_weather_alerts(severity);
