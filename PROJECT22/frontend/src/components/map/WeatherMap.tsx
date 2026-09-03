import React, { useState, useEffect, useCallback } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl';
import { HeatmapLayer, ScatterplotLayer } from '@deck.gl/layers';
import { DeckGL } from '@deck.gl/react';
import { weatherApi } from '../../services/api';
import { GridCell, ExtremeAlert } from '../../utils/types';
import { Layers, Eye, EyeOff } from 'lucide-react';

interface WeatherMapProps {
  variable: string;
  leadTime: number;
  onVariableChange: (v: string) => void;
  onLeadTimeChange: (lt: number) => void;
}

const variableColors: Record<string, [number, number, number, number][]> = {
  tp: [
    [0, 100, 0, 100],
    [0, 180, 0, 150],
    [0, 255, 0, 200],
    [255, 255, 0, 200],
    [255, 140, 0, 220],
    [255, 0, 0, 255],
  ],
  t2m: [
    [0, 0, 255, 100],
    [0, 150, 255, 150],
    [0, 255, 255, 200],
    [255, 255, 0, 200],
    [255, 140, 0, 220],
    [255, 0, 0, 255],
  ],
  u10: [
    [255, 255, 255, 100],
    [200, 200, 255, 150],
    [100, 100, 255, 200],
    [50, 50, 200, 220],
    [0, 0, 150, 255],
  ],
};

const WeatherMap: React.FC<WeatherMapProps> = ({
  variable,
  leadTime,
  onVariableChange,
  onLeadTimeChange,
}) => {
  const [gridData, setGridData] = useState<GridCell[]>([]);
  const [alerts, setAlerts] = useState<ExtremeAlert[]>([]);
  const [viewState, setViewState] = useState({
    longitude: 80,
    latitude: 22,
    zoom: 4.5,
  });
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const gridResponse = await weatherApi.getGridForecast(variable, leadTime);
      setGridData(gridResponse.data);

      const alertsResponse = await weatherApi.getExtremeAlerts();
      setAlerts(alertsResponse.alerts);
    } catch (error) {
      console.error('Error fetching data:', error);
      const mockGrid: GridCell[] = [];
      for (let lat = 0; lat <= 40; lat += 0.5) {
        for (let lon = 60; lon <= 100; lon += 0.5) {
          mockGrid.push({
            lat,
            lon,
            value: Math.random() * (variable === 'tp' ? 100 : variable === 't2m' ? 40 : 30),
          });
        }
      }
      setGridData(mockGrid);
    } finally {
      setLoading(false);
    }
  }, [variable, leadTime]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const heatmapLayer = new HeatmapLayer({
    id: 'heatmap',
    data: gridData,
    getPosition: (d: GridCell) => [d.lon, d.lat],
    getWeight: (d: GridCell) => d.value,
    radiusPixels: 60,
    intensity: 1,
    threshold: 0.1,
    colorRange: variableColors[variable] || variableColors.tp,
    visible: showHeatmap,
  });

  const alertLayer = new ScatterplotLayer({
    id: 'alerts',
    data: alerts,
    getPosition: (d: ExtremeAlert) => [d.longitude, d.latitude],
    getRadius: (d: ExtremeAlert) => {
      switch (d.severity) {
        case 'EXTREME': return 80000;
        case 'SEVERE': return 60000;
        case 'MODERATE': return 40000;
        default: return 20000;
      }
    },
    getFillColor: (d: ExtremeAlert) => {
      switch (d.severity) {
        case 'EXTREME': return [239, 68, 68, 200];
        case 'SEVERE': return [249, 115, 22, 200];
        case 'MODERATE': return [234, 179, 8, 180];
        default: return [34, 197, 94, 150];
      }
    },
    visible: showAlerts,
    pickable: true,
    onHover: (info: any) => setHoverInfo(info.object ? info : null),
  });

  const layers = [heatmapLayer, alertLayer];

  const variables = [
    { id: 'tp', label: 'Precipitation' },
    { id: 't2m', label: 'Temperature' },
    { id: 'u10', label: 'Wind U' },
    { id: 'v10', label: 'Wind V' },
  ];

  const leadTimes = [0, 6, 12, 24, 48, 72, 96, 120, 168, 240];

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
          Interactive Forecast Map
        </h3>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
            {variables.map((v) => (
              <button
                key={v.id}
                onClick={() => onVariableChange(v.id)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  variable === v.id
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <select
            value={leadTime}
            onChange={(e) => onLeadTimeChange(Number(e.target.value))}
            className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
          >
            {leadTimes.map((lt) => (
              <option key={lt} value={lt}>
                {lt}h
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`p-2 rounded-lg transition-all ${
              showHeatmap
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-slate-800/50 text-slate-400'
            }`}
          >
            {showHeatmap ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className={`p-2 rounded-lg transition-all ${
              showAlerts
                ? 'bg-red-500/20 text-red-300'
                : 'bg-slate-800/50 text-slate-400'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative h-[500px] rounded-2xl overflow-hidden border border-slate-700/50">
        <DeckGL
          viewState={viewState}
          onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
          layers={layers}
          controller={true}
          getTooltip={({ object }: any) => {
            if (!object) return null;
            if (object.latitude !== undefined) {
              return {
                text: `Lat: ${object.latitude.toFixed(2)}°\nLon: ${object.longitude.toFixed(2)}°\nValue: ${object.value.toFixed(1)}`,
                className: 'bg-slate-900/95 text-slate-100 px-3 py-2 rounded-lg text-sm',
              };
            }
            if (object.severity) {
              return {
                text: `${object.severity}: ${object.message}`,
                className: 'bg-slate-900/95 text-red-300 px-3 py-2 rounded-lg text-sm',
              };
            }
            return null;
          }}
        >
          <Map
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            attributionControl={false}
          />
        </DeckGL>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-10">
            <div className="text-slate-300">Loading forecast data...</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Low Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span>Severe</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 pulse-alert" />
          <span>Extreme</span>
        </div>
      </div>
    </div>
  );
};

export default WeatherMap;
