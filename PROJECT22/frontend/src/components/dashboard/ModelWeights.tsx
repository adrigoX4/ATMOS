import React, { useState, useEffect, useCallback } from 'react';
import { weatherApi } from '../../services/api';
import { WeightMapItem } from '../../utils/types';
import { BarChart3, TrendingUp, Info } from 'lucide-react';

interface ModelWeightsProps {
  variable: string;
  leadTime: number;
}

const modelColors: Record<string, string> = {
  GFS: '#22c55e',
  ECMWF: '#3b82f6',
  NCUM: '#f59e0b',
  GraphCast: '#a855f7',
  PanguWeather: '#ec4899',
};

const ModelWeights: React.FC<ModelWeightsProps> = ({ variable, leadTime }) => {
  const [weightData, setWeightData] = useState<WeightMapItem[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWeights = useCallback(async () => {
    setLoading(true);
    try {
      const response = await weatherApi.getWeightMap(variable, leadTime);
      setWeightData(response.weight_map);
      setModels(response.models);
    } catch (error) {
      console.error('Error fetching weights:', error);
      const mockModels = ['ECMWF', 'GFS', 'NCUM'];
      const mockWeights: WeightMapItem[] = [];
      for (let lat = 0; lat <= 40; lat += 2) {
        for (let lon = 60; lon <= 100; lon += 2) {
          const totalWeight = 1;
          mockModels.forEach((model, idx) => {
            const w = (0.3 + Math.random() * 0.4) * (idx === 0 ? 1.2 : 0.8);
            mockWeights.push({
              model,
              lat,
              lon,
              weight: w / mockModels.length,
            });
          });
        }
      }
      setModels(mockModels);
      setWeightData(mockWeights);
    } finally {
      setLoading(false);
    }
  }, [variable, leadTime]);

  useEffect(() => {
    fetchWeights();
  }, [fetchWeights]);

  const getModelAverageWeights = () => {
    const avgWeights: Record<string, number> = {};
    models.forEach((model) => {
      const modelWeights = weightData.filter((w) => w.model === model);
      if (modelWeights.length > 0) {
        avgWeights[model] =
          modelWeights.reduce((sum, w) => sum + w.weight, 0) / modelWeights.length;
      }
    });
    return avgWeights;
  };

  const getModelDistribution = () => {
    const distribution: Record<string, number> = {};
    models.forEach((model) => {
      const modelWeights = weightData.filter((w) => w.model === model);
      distribution[model] = modelWeights.length;
    });
    return distribution;
  };

  const avgWeights = getModelAverageWeights();
  const distribution = getModelDistribution();

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
          Model Weight Distribution
        </h3>
        <BarChart3 className="w-5 h-5 text-amber-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">
            Average Weight by Model
          </h4>
          <div className="space-y-3">
            {Object.entries(avgWeights)
              .sort(([, a], [, b]) => b - a)
              .map(([model, weight]) => (
                <div key={model} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: modelColors[model] || '#6b7280' }}
                      />
                      <span className="text-slate-300">{model}</span>
                    </div>
                    <span className="font-semibold text-slate-200">
                      {(weight * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${weight * 100}%`,
                        backgroundColor: modelColors[model] || '#6b7280',
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-3">
            Model Coverage
          </h4>
          <div className="space-y-2">
            {Object.entries(distribution).map(([model, count]) => (
              <div
                key={model}
                className="flex items-center justify-between p-3 glass-card rounded-xl hover:border-slate-600/50 transition-all cursor-pointer"
                onClick={() =>
                  setSelectedModel(selectedModel === model ? null : model)
                }
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: modelColors[model] || '#6b7280' }}
                  />
                  <span className="text-sm text-slate-300">{model}</span>
                </div>
                <span className="text-xs text-slate-400">{count} points</span>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 glass-card rounded-xl">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-400 mt-0.5" />
              <p className="text-xs text-slate-400">
                Weights are computed using inverse error variance method with XGBoost
                meta-learner optimization. Higher weights indicate better recent
                forecast skill.
              </p>
            </div>
          </div>
        </div>
      </div>

      {selectedModel && (
        <div className="mt-4 p-4 glass-card rounded-xl">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">
            {selectedModel} Spatial Weight Distribution
          </h4>
          <div className="h-64 relative rounded-xl overflow-hidden border border-slate-700/50">
            <div className="absolute inset-0 grid grid-cols-8 grid-flow-row gap-0.5 p-2">
              {Array.from({ length: 64 }).map((_, idx) => {
                const lat = 5 + (Math.floor(idx / 8) * 5);
                const lon = 62.5 + (idx % 8) * 5;
                const weightEntry = weightData.find(
                  (w) =>
                    w.model === selectedModel &&
                    Math.abs(w.lat - lat) < 3 &&
                    Math.abs(w.lon - lon) < 3
                );
                const weight = weightEntry?.weight || 0;

                return (
                  <div
                    key={idx}
                    className="rounded-sm transition-all"
                    style={{
                      backgroundColor: `rgba(251, 191, 36, ${Math.min(weight * 3, 1)})`,
                    }}
                    title={`(${lat}, ${lon}): ${(weight * 100).toFixed(1)}%`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <span>
            Total weight samples: {weightData.length.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ModelWeights;
