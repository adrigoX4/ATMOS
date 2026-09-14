export type WeatherMode = 'sun' | 'rain' | 'snow';

export interface WeatherPreset {
  temp: string;
  condition: string;
  wind: string;
  humidity: string;
  uv: string;
  bg: string;
  icon: string;
  location: string;
}

export interface ForecastPoint {
  latitude: number;
  longitude: number;
  variable: string;
  unit: string;
  forecast_series: ForecastSeriesItem[];
}

export interface ForecastSeriesItem {
  lead_time_hour: number;
  blended_value: number;
  model_weights: Record<string, number>;
  extreme_risk_level: string;
}

export interface GridCell {
  lat: number;
  lon: number;
  value: number;
}

export interface WeightMapItem {
  model: string;
  lat: number;
  lon: number;
  weight: number;
}

export interface ExtremeAlert {
  alert_id: string;
  type: string;
  severity: string;
  latitude: number;
  longitude: number;
  value: number;
  threshold: number;
  message: string;
  created_at: string;
}

export interface ModelMetrics {
  model: string;
  variable: string;
  metrics: MetricData[];
}

export interface MetricData {
  lead_time_hours: number;
  rmse: number;
  mae: number;
  bias: number;
  crps?: number;
  computed_at: string;
}

export interface HourlyForecastItem {
  time: string;
  temp: number;
  condition: string;
  icon: string;
}

export interface ModelInfo {
  id: string;
  api_key: string;
  type: 'deterministic' | 'ensemble';
  provider: string;
  skills?: Record<string, number>;
  members?: number;
}

export interface WeatherRegime {
  latitude: number;
  longitude: number;
  region: string;
  season: string;
  regime: string;
  timestamp: string;
}

export interface MultiSourceForecast {
  latitude: number;
  longitude: number;
  variable: string;
  forecasts: Record<string, {
    values: number[];
    times: string[];
  }>;
  model_count: number;
}
