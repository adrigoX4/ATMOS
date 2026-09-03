import axios from 'axios';
import { ForecastPoint, GridCell, WeightMapItem, ExtremeAlert, ModelMetrics } from '../utils/types';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const weatherApi = {
  async getPointForecast(
    lat: number,
    lon: number,
    variable: string = 'tp'
  ): Promise<ForecastPoint> {
    const { data } = await api.get('/forecast/point', {
      params: { lat, lon, variable },
    });
    return data;
  },

  async getGridForecast(
    variable: string = 'tp',
    leadTime: number = 24
  ): Promise<{ data: GridCell[] }> {
    const { data } = await api.get('/forecast/grid', {
      params: { variable, lead_time: leadTime },
    });
    return data;
  },

  async getWeightMap(
    variable: string = 'tp',
    leadTime: number = 24,
    model?: string
  ): Promise<{ models: string[]; weight_map: WeightMapItem[] }> {
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
    variable: string = 'tp'
  ): Promise<ModelMetrics> {
    const { data } = await api.get(`/metrics/${modelName}`, {
      params: { variable },
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
    variable: string = 'tp'
  ): Promise<any> {
    const { data } = await api.get('/probabilistic/forecast', {
      params: { lat, lon, variable },
    });
    return data;
  },

  async exportGeoTIFF(variable: string = 'tp', leadTime: number = 24): Promise<any> {
    const { data } = await api.get('/export/geotiff', {
      params: { variable, lead_time: leadTime },
    });
    return data;
  },

  async exportMultiBand(variables: string = 'tp,t2m,u10'): Promise<any> {
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
    variable: string = 'tp',
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
