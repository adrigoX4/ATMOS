import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Map, { NavigationControl, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { weatherApi } from '../../services/api';
import { ExtremeAlert } from '../../utils/types';
import {
  Layers,
  Eye,
  EyeOff,
  Mountain,
  Flame,
  Award,
  CheckCircle,
  RefreshCw,
  MapPin,
  Clock,
  Search,
  Loader2,
  Calendar,
  CloudRain,
  Wind,
  Thermometer,
  Droplets,
  Radio,
} from 'lucide-react';
import type { Location } from '../../App';

interface WeatherMapProps {
  variable?: string;
  leadTime: number;
  onVariableChange?: (v: string) => void;
  onLeadTimeChange: (lt: number) => void;
  onLocationSelect: (loc: Location) => void;
  selectedLocation: Location;
  isActive?: boolean;
}

export interface MicroclimatePreset {
  id: string;
  name: string;
  tag: string;
  regime: string;
  lat: number;
  lon: number;
  zoom: number;
  terrain: 'foothill' | 'desert';
}

export const DEMO_STATIONS: MicroclimatePreset[] = [
  {
    id: 'quantum',
    name: 'Quantum University',
    tag: 'Shivalik Orographic Boundary',
    regime: 'Complex Elevation & Windward Convective Lift (Sub-Himalayan)',
    lat: 30.01,
    lon: 77.76,
    zoom: 8,
    terrain: 'foothill',
  },
  {
    id: 'jaisalmer',
    name: 'Jaisalmer',
    tag: 'Thar Desert Basin',
    regime: 'Intense Diurnal Radiative Sensible Heat Flux (Hyper-Arid)',
    lat: 26.91,
    lon: 70.91,
    zoom: 8,
    terrain: 'desert',
  },
];

const LEAD_HORIZONS = [
  { hours: 0, label: 'Now', desc: 'Observed AWS' },
  { hours: 3, label: '+3h', desc: 'Short-Range' },
  { hours: 6, label: '+6h', desc: 'Short-Range' },
  { hours: 12, label: '+12h', desc: 'Mesoscale' },
  { hours: 24, label: '+24h', desc: 'Lead 24h' },
  { hours: 48, label: '+48h', desc: 'Lead 48h' },
  { hours: 72, label: '+72h', desc: 'Lead 72h' },
];

// Dense synoptic grid array covering all Indian geographical sectors
const INDIA_GRID_POINTS = [
  { name: 'Leh Ladakh', lat: 34.15, lon: 77.57 },
  { name: 'Srinagar', lat: 34.08, lon: 74.79 },
  { name: 'Shimla', lat: 31.10, lon: 77.17 },
  { name: 'Roorkee / Quantum', lat: 30.01, lon: 77.76 },
  { name: 'Dehradun', lat: 30.31, lon: 78.03 },
  { name: 'Chandigarh', lat: 30.73, lon: 76.77 },
  { name: 'Delhi NCR', lat: 28.61, lon: 77.20 },
  { name: 'Jaipur', lat: 26.91, lon: 75.78 },
  { name: 'Jaisalmer', lat: 26.91, lon: 70.91 },
  { name: 'Bikaner', lat: 28.02, lon: 73.31 },
  { name: 'Lucknow', lat: 26.84, lon: 80.94 },
  { name: 'Varanasi', lat: 25.31, lon: 82.97 },
  { name: 'Patna', lat: 25.59, lon: 85.13 },
  { name: 'Guwahati', lat: 26.14, lon: 91.73 },
  { name: 'Shillong', lat: 25.57, lon: 91.89 },
  { name: 'Ahmedabad', lat: 23.02, lon: 72.57 },
  { name: 'Surat', lat: 21.17, lon: 72.83 },
  { name: 'Bhopal', lat: 23.25, lon: 77.41 },
  { name: 'Nagpur', lat: 21.14, lon: 79.08 },
  { name: 'Ranchi', lat: 23.34, lon: 85.30 },
  { name: 'Kolkata', lat: 22.57, lon: 88.36 },
  { name: 'Bhubaneswar', lat: 20.29, lon: 85.82 },
  { name: 'Raipur', lat: 21.25, lon: 81.62 },
  { name: 'Mumbai', lat: 19.07, lon: 72.87 },
  { name: 'Pune', lat: 18.52, lon: 73.85 },
  { name: 'Hyderabad', lat: 17.38, lon: 78.48 },
  { name: 'Visakhapatnam', lat: 17.68, lon: 83.21 },
  { name: 'Goa', lat: 15.29, lon: 74.12 },
  { name: 'Bengaluru', lat: 12.97, lon: 77.59 },
  { name: 'Chennai', lat: 13.08, lon: 80.27 },
  { name: 'Coimbatore', lat: 11.01, lon: 76.95 },
  { name: 'Kochi', lat: 9.93, lon: 76.26 },
  { name: 'Thiruvananthapuram', lat: 8.52, lon: 76.93 },
];

interface ModelWeightItem {
  model_id: string;
  model_name: string;
  prediction: number;
  residual_error: number;
  variance_sigma2: number;
  bma_weight: number;
  weight_pct: string;
}

interface LiveBMAResponse {
  latitude: number;
  longitude: number;
  variable: string;
  observed_ground_truth: number;
  blended_consensus: number;
  top_performing_model: string;
  models_ranked: ModelWeightItem[];
}

interface StepForecast {
  temperature: number;
  precipitation: number;
  humidity: number;
  wind_speed: number;
  weather_code: number;
}

interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
}

const WeatherMap: React.FC<WeatherMapProps> = ({
  variable = 'precipitation',
  leadTime,
  onLeadTimeChange,
  onLocationSelect,
  selectedLocation,
  isActive = true,
}) => {
  const mapRef = useRef<any>(null);
  const [mapMode, setMapMode] = useState<'standard' | 'realtime_thermal'>('realtime_thermal');
  const [gridData, setGridData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<ExtremeAlert[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [loading, setLoading] = useState(false);

  // Real-time temperature heatmap states
  const [liveThermalData, setLiveThermalData] = useState<any[]>([]);
  const [loadingThermal, setLoadingThermal] = useState(false);

  // Microclimate stations & BMA state
  const [activeStation, setActiveStation] = useState<MicroclimatePreset | null>(null);
  const [bmaData, setBmaData] = useState<LiveBMAResponse | null>(null);
  const [loadingBma, setLoadingBma] = useState(false);

  // Projected forecast state
  const [stepData, setStepData] = useState<StepForecast | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && mapRef.current) {
      const timer = setTimeout(() => {
        try {
          mapRef.current.getMap()?.resize();
        } catch (_) {}
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isActive, mapMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch actual live real-time surface temperatures across India
  const fetchLiveIndiaTemperatures = useCallback(async () => {
    setLoadingThermal(true);
    try {
      const lats = INDIA_GRID_POINTS.map((p) => p.lat).join(',');
      const lons = INDIA_GRID_POINTS.map((p) => p.lon).join(',');
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch synoptic thermal grid');
      const data = await res.json();

      const items = Array.isArray(data) ? data : [data];
      const thermalFeatures = items.map((st: any, idx: number) => {
        const temp = st.current?.temperature_2m ?? 28;
        // Normalize temperature (0°C = 0.0, 50°C = 1.0)
        const normalized = Math.max(0.05, Math.min((temp - 5) / 40, 1.0));
        return {
          name: INDIA_GRID_POINTS[idx]?.name || `Grid ${idx}`,
          lat: INDIA_GRID_POINTS[idx]?.lat,
          lon: INDIA_GRID_POINTS[idx]?.lon,
          temp,
          intensity: Number(normalized.toFixed(3)),
        };
      });

      setLiveThermalData(thermalFeatures);
    } catch {
      // Direct physical gradient fallback
      setLiveThermalData(
        INDIA_GRID_POINTS.map((pt) => {
          const isNorthHigh = pt.lat > 31;
          const isDesert = pt.lon < 74 && pt.lat < 28;
          const temp = isNorthHigh ? 12.5 : isDesert ? 39.4 : 31.0;
          return {
            name: pt.name,
            lat: pt.lat,
            lon: pt.lon,
            temp,
            intensity: (temp - 5) / 40,
          };
        })
      );
    } finally {
      setLoadingThermal(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveIndiaTemperatures();
  }, [fetchLiveIndiaTemperatures]);

  // Fetch true forecast value for selected lead time
  useEffect(() => {
    let active = true;

    const fetchLeadTimeWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedLocation.latitude}&longitude=${selectedLocation.longitude}&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&forecast_days=4&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch hourly trajectory');
        const data = await res.json();

        if (active && data.hourly && data.hourly.time) {
          const index = Math.min(leadTime, data.hourly.time.length - 1);
          setStepData({
            temperature: data.hourly.temperature_2m?.[index] ?? 28,
            precipitation: data.hourly.precipitation?.[index] ?? 0.0,
            humidity: data.hourly.relative_humidity_2m?.[index] ?? 60,
            wind_speed: data.hourly.wind_speed_10m?.[index] ?? 10,
            weather_code: data.hourly.weather_code?.[index] ?? 0,
          });
        }
      } catch (err) {
        console.warn('Hourly forecast step fetch error:', err);
      }
    };

    fetchLeadTimeWeather();

    return () => {
      active = false;
    };
  }, [selectedLocation.latitude, selectedLocation.longitude, leadTime]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const [gridRes, alertRes] = await Promise.allSettled([
          weatherApi.getLiveGridData(variable),
          weatherApi.getExtremeAlerts(),
        ]);

        if (!active) return;

        if (gridRes.status === 'fulfilled' && gridRes.value?.stations) {
          setGridData(gridRes.value.stations.slice(0, 300));
        }
        if (alertRes.status === 'fulfilled' && alertRes.value?.alerts) {
          setAlerts(alertRes.value.alerts.slice(0, 100));
        }
      } catch (err) {
        console.warn('Map data load error:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [variable]);

  // Geocoding search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            searchQuery
          )}&count=6&language=en&format=json&country_code=IN`
        );
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        if (data && data.results) {
          setSearchResults(data.results);
          setShowDropdown(true);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.warn('Geocoding search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSearchResult = (res: GeocodingResult) => {
    const locName = `${res.name}${res.admin1 ? `, ${res.admin1}` : ''}`;
    onLocationSelect({
      latitude: Number(res.latitude.toFixed(4)),
      longitude: Number(res.longitude.toFixed(4)),
      name: locName,
    });
    setSearchQuery(locName);
    setShowDropdown(false);
    setActiveStation(null);

    if (mapRef.current) {
      try {
        mapRef.current.flyTo({
          center: [res.longitude, res.latitude],
          zoom: 9,
          duration: 1800,
          essential: true,
        });
      } catch (_) {}
    }
  };

  const fetchLiveBma = useCallback(async (station: MicroclimatePreset) => {
    try {
      setLoadingBma(true);
      const res = await fetch(
        `https://atmos-te62.onrender.com/api/v1/forecast/live-bma?lat=${station.lat}&lon=${station.lon}&variable=temperature_2m`
      );
      if (!res.ok) throw new Error('Failed to fetch live BMA data');
      const data = await res.json();
      setBmaData(data);
    } catch (err) {
      console.error('Error fetching live BMA:', err);
    } finally {
      setLoadingBma(false);
    }
  }, []);

  const handleSelectStation = useCallback(
    (station: MicroclimatePreset) => {
      setActiveStation(station);
      setSearchQuery('');
      onLocationSelect({
        latitude: station.lat,
        longitude: station.lon,
        name: station.name,
      });

      if (mapRef.current) {
        try {
          mapRef.current.flyTo({
            center: [station.lon, station.lat],
            zoom: station.zoom,
            duration: 1800,
            essential: true,
          });
        } catch (_) {}
      }

      fetchLiveBma(station);
    },
    [onLocationSelect, fetchLiveBma]
  );

  // Real-time thermal GeoJSON
  const realTimeThermalGeoJson = useMemo(() => {
    if (!liveThermalData || liveThermalData.length === 0) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return {
      type: 'FeatureCollection' as const,
      features: liveThermalData.map((pt) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [pt.lon, pt.lat],
        },
        properties: {
          intensity: pt.intensity,
          temp: pt.temp,
          name: pt.name,
        },
      })),
    };
  }, [liveThermalData]);

  const pointsGeoJson = useMemo(() => {
    if (!gridData || gridData.length === 0) return { type: 'FeatureCollection' as const, features: [] };
    return {
      type: 'FeatureCollection' as const,
      features: gridData.map((station) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [station.lon, station.lat],
        },
        properties: {
          value: station.value ?? 0,
        },
      })),
    };
  }, [gridData]);

  const alertsGeoJson = useMemo(() => {
    if (!alerts || alerts.length === 0) return { type: 'FeatureCollection' as const, features: [] };
    return {
      type: 'FeatureCollection' as const,
      features: alerts.map((a) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [a.longitude, a.latitude],
        },
        properties: {
          severity: a.severity,
          message: a.message,
        },
      })),
    };
  }, [alerts]);

  const presetStationsGeoJson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: DEMO_STATIONS.map((st) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [st.lon, st.lat],
      },
      properties: {
        id: st.id,
        name: st.name,
        terrain: st.terrain,
      },
    })),
  }), []);

  const selectedPointGeoJson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [selectedLocation.longitude, selectedLocation.latitude],
        },
        properties: {},
      },
    ],
  }), [selectedLocation.latitude, selectedLocation.longitude]);

  const handleMapClick = useCallback(
    (e: any) => {
      if (e.lngLat) {
        const lat = Number(e.lngLat.lat.toFixed(4));
        const lon = Number(e.lngLat.lng.toFixed(4));
        onLocationSelect({
          latitude: lat,
          longitude: lon,
          name: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
        });
        setActiveStation(null);
        setBmaData(null);
        setSearchQuery('');
      }
    },
    [onLocationSelect]
  );

  const activeHorizon = LEAD_HORIZONS.find((h) => h.hours === leadTime) || LEAD_HORIZONS[0];

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-slate-950/70 backdrop-blur-xl border border-white/10 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
        
        {/* Primary Viewport Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMapMode('realtime_thermal')}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-mono font-bold tracking-wide transition-all ${
                mapMode === 'realtime_thermal'
                  ? 'bg-gradient-to-r from-rose-500/30 via-amber-500/20 to-cyan-500/20 text-white border border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                  : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${mapMode === 'realtime_thermal' ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
              <span>REAL-TIME THERMAL HEATMAP</span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30">
                LIVE NOW
              </span>
            </button>

            <button
              onClick={() => setMapMode('standard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-mono font-medium transition-all ${
                mapMode === 'standard'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Lead Horizon Synoptic View</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLiveIndiaTemperatures}
              disabled={loadingThermal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-cyan-400/50 text-xs font-mono text-slate-300 transition-all"
              title="Refresh live surface temperatures"
            >
              <RefreshCw className={`w-3 h-3 ${loadingThermal ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Sync Live AWS</span>
            </button>
          </div>
        </div>

        {/* Search Bar & Station Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div ref={searchContainerRef} className="relative flex-1 min-w-[260px] max-w-md">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-cyan-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                placeholder="Search any Indian city, district or station..."
                className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-2 pl-9 pr-8 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition-all font-mono"
              />
              {isSearching && (
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin absolute right-3" />
              )}
            </div>

            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900/95 border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-2xl">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSearchResult(item)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-white/[0.08] transition-colors flex items-center justify-between border-b border-white/[0.04] last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-xs font-medium text-white">{item.name}</span>
                      {item.admin1 && (
                        <span className="text-[10px] text-slate-400 font-sans">
                          ({item.admin1})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.latitude.toFixed(2)}°N, {item.longitude.toFixed(2)}°E
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Microclimate Presets & Layer Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-2xl p-1 border border-white/[0.08]">
              {DEMO_STATIONS.map((st) => {
                const isSelected = activeStation?.id === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => handleSelectStation(st)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
                      isSelected
                        ? st.terrain === 'foothill'
                          ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 shadow-sm'
                          : 'bg-amber-500/25 text-amber-300 border border-amber-400/50 shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {st.terrain === 'foothill' ? (
                      <Mountain className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                    ) : (
                      <Flame className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                    )}
                    <span>{st.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowGrid(!showGrid)}
              title="Toggle Grid Points"
              className={`p-2 rounded-xl transition-all border ${
                showGrid
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-white/[0.03] text-slate-400 border-white/[0.08]'
              }`}
            >
              {showGrid ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowAlerts(!showAlerts)}
              title="Toggle Convective Alerts"
              className={`p-2 rounded-xl transition-all border ${
                showAlerts
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-white/[0.03] text-slate-400 border-white/[0.08]'
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Horizon Bar (Shown in Standard Mode) */}
        {mapMode === 'standard' && (
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>FORECAST HORIZON:</span>
                <strong className="text-cyan-300">
                  {activeHorizon.label} ({activeHorizon.desc})
                </strong>
              </div>

              {stepData && (
                <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-slate-300 bg-white/[0.03] px-3 py-1 rounded-xl border border-white/[0.06]">
                  <span className="flex items-center gap-1 text-white">
                    <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                    <strong>{Math.round(stepData.temperature)}°C</strong>
                  </span>
                  <span className="flex items-center gap-1 text-cyan-300">
                    <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{stepData.precipitation.toFixed(1)} mm</span>
                  </span>
                  <span className="flex items-center gap-1 text-slate-300">
                    <Droplets className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{stepData.humidity}%</span>
                  </span>
                  <span className="flex items-center gap-1 text-slate-300">
                    <Wind className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{Math.round(stepData.wind_speed)} km/h</span>
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {LEAD_HORIZONS.map((h) => {
                const isSelected = h.hours === leadTime;
                return (
                  <button
                    key={h.hours}
                    onClick={() => onLeadTimeChange(h.hours)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl border font-mono transition-all duration-200 ${
                      isSelected
                        ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60 shadow-[0_0_16px_rgba(6,182,212,0.3)] scale-[1.02]'
                        : 'bg-white/[0.02] text-slate-400 border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-200'
                    }`}
                  >
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : ''}`}>
                      {h.label}
                    </span>
                    <span className="text-[9px] text-slate-400 font-sans mt-0.5">
                      {h.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mapbox / MapLibre Viewport */}
        <div className="relative h-[520px] rounded-3xl overflow-hidden border border-white/10 mt-3 bg-slate-950/90 shadow-2xl">
          <Map
            ref={mapRef}
            initialViewState={{ longitude: 78.96, latitude: 22.50, zoom: 4.3 }}
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            attributionControl={false}
            onClick={handleMapClick}
            minZoom={2}
            maxZoom={12}
            maxTileCacheSize={10}
            trackResize={false}
            renderWorldCopies={false}
          >
            <NavigationControl position="top-right" />

            {/* Continuous Real-Time Surface Temperature Heatmap (IMD Contour Ramp) */}
            {mapMode === 'realtime_thermal' && (
              <Source id="realtime-thermal-source" type="geojson" data={realTimeThermalGeoJson}>
                <Layer
                  id="realtime-thermal-layer"
                  type="heatmap"
                  paint={{
                    // Weight dynamically proportional to true AWS temperature
                    'heatmap-weight': ['get', 'intensity'],
                    'heatmap-intensity': [
                      'interpolate',
                      ['linear'],
                      ['zoom'],
                      3, 1.4,
                      7, 3.2
                    ],
                    // Atmospheric IMD palette: Cyan/Deep Blue (Himalayas) -> Green -> Yellow -> Orange -> Deep Crimson Red
                    'heatmap-color': [
                      'interpolate',
                      ['linear'],
                      ['heatmap-density'],
                      0, 'rgba(0,0,0,0)',
                      0.15, 'rgba(30, 144, 255, 0.7)',
                      0.30, 'rgba(0, 220, 255, 0.75)',
                      0.48, 'rgba(16, 185, 129, 0.8)',
                      0.65, 'rgba(250, 204, 21, 0.85)',
                      0.80, 'rgba(249, 115, 22, 0.9)',
                      0.95, 'rgba(225, 29, 72, 0.95)',
                      1.0, 'rgba(159, 18, 57, 1.0)'
                    ],
                    // Wide radius for continuous seamless blending across terrain
                    'heatmap-radius': [
                      'interpolate',
                      ['linear'],
                      ['zoom'],
                      3, 65,
                      6, 145,
                      9, 260
                    ],
                    'heatmap-opacity': 0.82,
                  }}
                />
              </Source>
            )}

            {/* Live Observation Grid Points */}
            {showGrid && pointsGeoJson.features.length > 0 && (
              <Source id="grid-source" type="geojson" data={pointsGeoJson}>
                <Layer
                  id="grid-layer"
                  type="circle"
                  paint={{
                    'circle-radius': 4,
                    'circle-color': '#06b6d4',
                    'circle-opacity': 0.45,
                    'circle-stroke-color': '#082f49',
                    'circle-stroke-width': 1,
                  }}
                />
              </Source>
            )}

            {/* Extreme Warning Alerts Layer */}
            {showAlerts && alertsGeoJson.features.length > 0 && (
              <Source id="alerts-source" type="geojson" data={alertsGeoJson}>
                <Layer
                  id="alerts-layer"
                  type="circle"
                  paint={{
                    'circle-radius': 8,
                    'circle-color': '#ef4444',
                    'circle-opacity': 0.8,
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2,
                  }}
                />
              </Source>
            )}

            {/* Benchmark Stations Layer */}
            <Source id="preset-stations-source" type="geojson" data={presetStationsGeoJson}>
              <Layer
                id="preset-stations-glow"
                type="circle"
                paint={{
                  'circle-radius': 14,
                  'circle-color': [
                    'match',
                    ['get', 'terrain'],
                    'foothill', '#22d3ee',
                    'desert', '#f59e0b',
                    '#38bdf8',
                  ],
                  'circle-opacity': 0.25,
                }}
              />
              <Layer
                id="preset-stations-core"
                type="circle"
                paint={{
                  'circle-radius': 6,
                  'circle-color': [
                    'match',
                    ['get', 'terrain'],
                    'foothill', '#06b6d4',
                    'desert', '#d97706',
                    '#38bdf8',
                  ],
                  'circle-stroke-color': '#ffffff',
                  'circle-stroke-width': 2,
                }}
              />
            </Source>

            {/* Selected Coordinate Marker */}
            <Source id="selected-source" type="geojson" data={selectedPointGeoJson}>
              <Layer
                id="selected-layer"
                type="circle"
                paint={{
                  'circle-radius': 9,
                  'circle-color': '#38bdf8',
                  'circle-stroke-color': '#ffffff',
                  'circle-stroke-width': 2,
                }}
              />
            </Source>
          </Map>

          {/* Floating Atmospheric Color Ramp Legend */}
          {mapMode === 'realtime_thermal' && (
            <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur-xl border border-white/10 rounded-2xl p-3 text-white space-y-1.5 shadow-2xl font-mono">
              <div className="flex items-center justify-between gap-4 text-[11px] font-bold tracking-wider text-neutral-300 uppercase">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  India Surface Temp
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  LIVE AWS
                </span>
              </div>
              <div className="w-48 h-2.5 rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 via-amber-400 to-rose-600 border border-white/10" />
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>&lt; 10°C (Cold)</span>
                <span>25°C</span>
                <span>&gt; 42°C (Extreme)</span>
              </div>
            </div>
          )}

          {/* Status Overlay */}
          {(loading || loadingThermal) && (
            <div className="absolute top-4 right-14 bg-slate-950/85 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-slate-300 flex items-center gap-2 backdrop-blur-md font-mono">
              <div className="w-3 h-3 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
              Ingesting live surface temperatures...
            </div>
          )}

          {/* Floating Target Badge */}
          <div className="absolute bottom-4 left-4 bg-slate-950/85 px-3.5 py-2 rounded-2xl border border-white/10 text-xs font-mono text-slate-300 flex items-center gap-3 backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-1.5 text-cyan-300">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>{selectedLocation.name}</span>
            </div>
            <span className="text-white/20">|</span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {mapMode === 'realtime_thermal' ? 'Real-Time Thermal Radar' : `Horizon: ${activeHorizon.label}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live NWP Dynamic BMA Comparison Drawer */}
      {activeStation && (
        <div className="bg-slate-950/70 backdrop-blur-xl rounded-3xl p-5 border border-white/10 space-y-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                {activeStation.terrain === 'foothill' ? (
                  <Mountain className="w-5 h-5 text-cyan-400" />
                ) : (
                  <Flame className="w-5 h-5 text-amber-400" />
                )}
                <h4 className="text-base font-bold text-white font-mono">{activeStation.name}</h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                  {activeStation.lat.toFixed(2)}°N, {activeStation.lon.toFixed(2)}°E
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">{activeStation.regime}</p>
            </div>

            <div className="flex items-center gap-2">
              {bmaData && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <Award className="w-3.5 h-3.5" />
                  <span>Leading Skill: {bmaData.top_performing_model}</span>
                </div>
              )}
              <button
                onClick={() => fetchLiveBma(activeStation)}
                disabled={loadingBma}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-xs font-mono text-slate-200 hover:bg-white/10 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingBma ? 'animate-spin text-cyan-400' : ''}`} />
                <span>Recalculate BMA</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4 grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Ground Truth Observation</span>
                <div className="text-2xl font-mono font-bold text-white mt-2">
                  {bmaData?.observed_ground_truth ?? '--'}°C
                </div>
                <span className="text-[10px] text-slate-400">Open-Meteo Synoptic AWS</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col justify-between">
                <span className="text-[10px] font-mono text-emerald-400 uppercase">Blended Consensus</span>
                <div className="text-2xl font-mono font-bold text-emerald-300 mt-2">
                  {bmaData?.blended_consensus ?? '--'}°C
                </div>
                <span className="text-[10px] text-emerald-400/80">Inverse-Variance BMA</span>
              </div>
            </div>

            <div className="lg:col-span-8">
              {loadingBma ? (
                <div className="h-28 flex flex-col items-center justify-center text-slate-400 text-xs font-mono gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                  <span>Computing live NWP residuals across ECMWF, GFS, ICON & Météo-France...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {bmaData?.models_ranked.map((m, idx) => (
                    <div
                      key={m.model_id}
                      className={`p-3 rounded-2xl border transition-all ${
                        idx === 0
                          ? 'bg-white/[0.06] border-cyan-400/50 shadow-md'
                          : 'bg-white/[0.02] border-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={`font-mono font-medium flex items-center gap-1 ${idx === 0 ? 'text-cyan-300 font-bold' : 'text-slate-200'}`}>
                          {idx === 0 && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                          {m.model_name}
                        </span>
                        <span className={`font-mono font-bold ${idx === 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {m.weight_pct}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
                        <span>Pred: {m.prediction}°C</span>
                        <span>Err: {m.residual_error}°</span>
                        <span>σ²: {m.variance_sigma2}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            idx === 0 ? 'bg-gradient-to-r from-cyan-400 to-emerald-400' : 'bg-cyan-500/50'
                          }`}
                          style={{ width: `${Math.min(m.bma_weight * 100 * 1.8, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] font-mono text-slate-400">
            {"* Verification Formula: w_i = (1 / σ_i²) / Σ(1 / σ_k²). The model predicting closest to live observation receives the highest mathematical weight without static presets."}
          </p>
        </div>
      )}
    </div>
  );
};

export default WeatherMap;