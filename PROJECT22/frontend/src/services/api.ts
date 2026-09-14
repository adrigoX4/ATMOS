import axios from 'axios';
import {
  ForecastPoint, GridCell, WeightMapItem, ExtremeAlert,
  ModelMetrics, ModelInfo, WeatherRegime, MultiSourceForecast,
} from '../utils/types';

declare const process: any;

const API_BASE = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) 
  ? process.env.REACT_APP_API_URL 
  : 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000, // 60s timeout prevents premature Axios cancellations
  headers: {
    'Content-Type': 'application/json',
  },
});

export const weatherApi = {
  async getModels(): Promise<any> {
    const { data } = await api.get('/forecast/models');
    return data;
  },

  async getPointForecast(
    lat: number,
    lon: number,
    variable: string = 'temperature'
  ): Promise<ForecastPoint> {
    const { data } = await api.get('/forecast/point', {
      params: { lat, lon, variable },
    });
    return data;
  },

  async getGridForecast(
    variable: string = 'temperature',
    leadTime: number = 24
  ): Promise<{ data: GridCell[] }> {
    const { data } = await api.get('/forecast/grid', {
      params: { variable, lead_time: leadTime },
    });
    return data;
  },

  async getWeightMap(
    variable: string = 'temperature',
    leadTime: number = 24,
    model?: string
  ): Promise<{
    models: string[];
    weight_map: WeightMapItem[];
    regime: string;
    region: string;
    season: string;
    lead_time_weights: Record<string, Record<string, number>>;
  }> {
    const { data } = await api.get('/weights', {
      params: { variable, lead_time: leadTime, model },
    });
    return data;
  },

  async getExtremeAlerts(
    alertType?: string,
    severity?: string
  ): Promise<{ alerts: ExtremeAlert[]; total: number }> {
    const { data } = await api.get('/alerts/extreme', {
      params: { alert_type: alertType, severity },
    });
    return data;
  },

  async getModelMetrics(
    modelName: string,
    variable: string = 'temperature'
  ): Promise<ModelMetrics> {
    const { data } = await api.get(`/metrics/${modelName}`, {
      params: { variable },
    });
    return data;
  },

  async getLiveGridData(
    variable: string = 'temperature'
  ): Promise<{ stations: { lat: number; lon: number; value: number }[]; count: number }> {
    const { data } = await api.get('/live/grid', {
      params: { variable },
    });
    return data;
  },

  async getLiveWeather(
    lat: number,
    lon: number
  ): Promise<{ current: Record<string, number>; latitude: number; longitude: number }> {
    const { data } = await api.get('/live/weather', {
      params: { lat, lon },
    });
    return data;
  },

  async getModelInfo(): Promise<{ models: ModelInfo[]; total: number }> {
    const { data } = await api.get('/models/info');
    return data;
  },

  async getWeatherRegime(
    lat: number = 28.61,
    lon: number = 77.21,
    variable: string = 'temperature'
  ): Promise<WeatherRegime> {
    const { data } = await api.get('/regime', {
      params: { lat, lon, variable },
    });
    return data;
  },

  async getMultiSourceForecast(
    lat: number,
    lon: number,
    variable: string = 'temperature',
    forecastDays: number = 7
  ): Promise<MultiSourceForecast> {
    const { data } = await api.get('/forecast/point/multi-source', {
      params: { lat, lon, variable, forecast_days: forecastDays },
    });
    return data;
  },

  async getForecastRuns(): Promise<{ runs: any[] }> {
    const { data } = await api.get('/runs');
    return data;
  },

  async getProbabilisticForecast(
    lat: number,
    lon: number,
    variable: string = 'temperature'
  ): Promise<any> {
    const { data } = await api.get('/probabilistic/forecast', {
      params: { lat, lon, variable },
    });
    return data;
  },

  async exportGeoTIFF(variable: string = 'temperature', leadTime: number = 24): Promise<any> {
    const { data } = await api.get('/export/geotiff', {
      params: { variable, lead_time: leadTime },
    });
    return data;
  },

  async exportMultiBand(variables: string = 'temperature,precipitation,wind_speed'): Promise<any> {
    const { data } = await api.get('/export/multiband', {
      params: { variables },
    });
    return data;
  },

  async listABExperiments(): Promise<any> {
    const { data } = await api.get('/ab-testing/experiments');
    return data;
  },

  async createABExperiment(name: string): Promise<any> {
    const { data } = await api.post('/ab-testing/experiment', null, {
      params: { name },
    });
    return data;
  },

  async getABExperimentResults(experimentId: string): Promise<any> {
    const { data } = await api.get(`/ab-testing/experiment/${experimentId}`);
    return data;
  },

  async getRetrainingStatus(): Promise<any> {
    const { data } = await api.get('/retraining/status');
    return data;
  },

  async getCacheStats(): Promise<any> {
    const { data } = await api.get('/cache/stats');
    return data;
  },

  async invalidateCache(modelName: string): Promise<any> {
    const { data } = await api.post(`/cache/invalidate/${modelName}`);
    return data;
  },

  async getEarthEngineVerification(
    variable: string = 'temperature',
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    const { data } = await api.get('/earth-engine/verification', {
      params: { variable, start_date: startDate, end_date: endDate },
    });
    return data;
  },
};

export default api;