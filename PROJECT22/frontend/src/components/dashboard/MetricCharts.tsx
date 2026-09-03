import React, { useState, useEffect, useCallback } from 'react';
import { weatherApi } from '../../services/api';
import { ModelMetrics, MetricData } from '../../utils/types';
import { Activity, TrendingDown, TrendingUp, BarChart3 } from 'lucide-react';

interface MetricChartsProps {
  variable: string;
}

const modelColors: Record<string, string> = {
  GFS: '#22c55e',
  ECMWF: '#3b82f6',
  NCUM: '#f59e0b',
  GraphCast: '#a855f7',
};

const MetricCharts: React.FC<MetricChartsProps> = ({ variable }) => {
  const [metricsData, setMetricsData] = useState<Record<string, ModelMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'rmse' | 'mae' | 'bias'>('rmse');

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const models = ['GFS', 'ECMWF', 'NCUM'];
      const results: Record<string, ModelMetrics> = {};

      for (const model of models) {
        try {
          const data = await weatherApi.getModelMetrics(model, variable);
          results[model] = data;
        } catch {
          const mockMetrics: MetricData[] = Array.from({ length: 5 }).map((_, idx) => ({
            lead_time_hours: (idx + 1) * 24,
            rmse: 2 + idx * 0.5 + Math.random() * 0.5,
            mae: 1.5 + idx * 0.3 + Math.random() * 0.3,
            bias: (Math.random() - 0.5) * 2,
            computed_at: new Date().toISOString(),
          }));
          results[model] = {
            model,
            variable,
            metrics: mockMetrics,
          };
        }
      }

      setMetricsData(results);
    } finally {
      setLoading(false);
    }
  }, [variable]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const getMaxValue = () => {
    let max = 0;
    Object.values(metricsData).forEach((modelData) => {
      modelData.metrics.forEach((m) => {
        const val = Math.abs(m[selectedMetric]);
        if (val > max) max = val;
      });
    });
    return max || 10;
  };

  const maxValue = getMaxValue();

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
          Model Verification Metrics
        </h3>
        <Activity className="w-5 h-5 text-amber-400" />
      </div>

      <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
        {(['rmse', 'mae', 'bias'] as const).map((metric) => (
          <button
            key={metric}
            onClick={() => setSelectedMetric(metric)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              selectedMetric === metric
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {metric.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50 animate-pulse" />
          <p className="text-sm">Loading metrics data...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(metricsData).map(([model, modelData]) => (
            <div key={model} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: modelColors[model] || '#6b7280' }}
                  />
                  <span className="text-sm font-semibold text-slate-300">{model}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {modelData.metrics.length > 0 && (
                    <>
                      {selectedMetric === 'rmse' || selectedMetric === 'mae' ? (
                        <TrendingDown className="w-3 h-3 text-green-400" />
                      ) : (
                        <TrendingUp className="w-3 h-3 text-amber-400" />
                      )}
                      <span>
                        Latest: {modelData.metrics[modelData.metrics.length - 1][selectedMetric].toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="h-24 flex items-end gap-1">
                {modelData.metrics.map((m, idx) => {
                  const height = (Math.abs(m[selectedMetric]) / maxValue) * 100;
                  const isNegative = m[selectedMetric] < 0 && selectedMetric === 'bias';

                  return (
                    <div
                      key={idx}
                      className="flex-1 relative group"
                      title={`${m.lead_time_hours}h: ${m[selectedMetric].toFixed(2)}`}
                    >
                      <div
                        className="absolute bottom-0 w-full rounded-t transition-all duration-300"
                        style={{
                          height: `${height}%`,
                          backgroundColor: isNegative
                            ? '#ef4444'
                            : modelColors[model] || '#6b7280',
                          opacity: 0.8,
                        }}
                      />
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-900/90 px-2 py-1 rounded">
                        {m[selectedMetric].toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-xs text-slate-500">
                <span>24h</span>
                <span>120h</span>
              </div>
            </div>
          ))}

          <div className="mt-6 p-4 glass-card rounded-xl">
            <div className="flex items-start gap-2">
              <BarChart3 className="w-4 h-4 text-sky-400 mt-0.5" />
              <div className="text-xs text-slate-400 space-y-1">
                <p>
                  <strong className="text-slate-300">RMSE</strong> - Root Mean Square Error: Lower is better
                </p>
                <p>
                  <strong className="text-slate-300">MAE</strong> - Mean Absolute Error: Lower is better
                </p>
                <p>
                  <strong className="text-slate-300">BIAS</strong> - Forecast Bias: Closer to 0 is better
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricCharts;
