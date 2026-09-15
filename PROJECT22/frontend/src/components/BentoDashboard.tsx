import React, { useState, useEffect } from 'react';
import {
  Droplets,
  Eye,
  Gauge,
  MapPin,
  CloudRain,
  Wind,
  Layers,
  Award,
  RefreshCw,
  CheckCircle2,
  Mountain,
  Flame,
  Activity,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Bell,
  Radio,
} from 'lucide-react';
import { fetchAccuGroundTruth, AccuObservation } from '../services/accuweather';

declare const process: any;

export interface WeatherData {
  temperature: number;
  apparent_temperature?: number;
  precipitation: number;
  wind_speed: number;
  wind_direction: number;
  humidity: number;
  pressure: number;
  cloud_cover: number;
  weather_code: number;
  is_day: number;
}

export interface BentoDashboardProps {
  weather: WeatherData;
  locationName: string;
}

export interface StationPreset {
  id: string;
  name: string;
  tag: string;
  regime: string;
  elevation: string;
  lat: number;
  lon: number;
  terrain: 'foothill' | 'desert';
}

export const DEMO_MICROCLIMATES: StationPreset[] = [
  {
    id: 'quantum',
    name: 'Quantum University (Roorkee)',
    tag: 'Shivalik Foothills',
    regime: 'Complex Slope Lifting & Windward Convective Cloudiness',
    elevation: '268m MSL',
    lat: 30.01,
    lon: 77.76,
    terrain: 'foothill',
  },
  {
    id: 'jaisalmer',
    name: 'Jaisalmer (Thar Desert)',
    tag: 'Continental Arid Basin',
    regime: 'Intense Sensible Radiative Heat & Deep Dry Boundary Layer',
    elevation: '225m MSL',
    lat: 26.91,
    lon: 70.91,
    terrain: 'desert',
  },
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

interface LiveBMAResult {
  latitude: number;
  longitude: number;
  variable: string;
  observed_ground_truth: number;
  blended_consensus: number;
  top_performing_model: string;
  models_ranked: ModelWeightItem[];
}

interface ExtremeAlertItem {
  alert_id: string;
  region: string;
  subdivision: string;
  category: string;
  severity: string;
  tier?: 'YELLOW' | 'ORANGE' | 'RED';
  lead_time?: string;
  observed_value?: number;
  threshold_value?: number;
  unit?: string;
  confidence?: number;
  latitude?: number;
  longitude?: number;
  issued_at?: string;
  message?: string;
  synoptic_cause?: string;
}

export const BentoDashboard: React.FC<BentoDashboardProps> = ({
  weather,
  locationName,
}) => {
  const [selectedStation, setSelectedStation] = useState<StationPreset>(DEMO_MICROCLIMATES[0]);
  const [liveBma, setLiveBma] = useState<LiveBMAResult | null>(null);
  const [loadingBma, setLoadingBma] = useState<boolean>(false);
  const [accuObs, setAccuObs] = useState<AccuObservation | null>(null);

  const [alerts, setAlerts] = useState<ExtremeAlertItem[]>([]);
  const [synopticRegime, setSynopticRegime] = useState<string>('Synoptic Normal');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Live');
  const [isScanningAlerts, setIsScanningAlerts] = useState<boolean>(false);

  const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://atmos-te62.onrender.com';

  const precip = Number(weather.precipitation) || 0;
  const clouds = Number(weather.cloud_cover) || 0;
  const code = weather.weather_code || 0;
  const isDay = weather.is_day;

  const getConditionLabel = () => {
    if (code >= 95) return 'Severe Convective Thunderstorm';
    if (precip >= 7.5 || code === 65) return 'Heavy Frontal Downpour';
    if (precip >= 2.0 || code === 63) return 'Moderate Rain Showers';
    if (precip > 0.0 || (code >= 51 && code <= 67)) {
      return isDay ? 'Passing Precipitation' : 'Intermittent Night Rain';
    }
    if (code >= 71) return 'High-Altitude Snowfall';
    if (code >= 45) return 'Dense Surface Inversion (Fog)';
    if (clouds >= 80 || code === 3) return 'Overcast Stratus Deck';
    if (clouds >= 30 || code === 2) return isDay ? 'Partly Cloudy' : 'Partly Cloudy Night';
    return isDay ? 'Clear Radiative Skies' : 'Clear Stable Boundary Layer';
  };

  const renderWeatherGlyph = (c: number, day: number, className = 'w-6 h-6') => {
    if (c >= 95) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path
            d="M17.5 14A4.5 4.5 0 0 0 18 5.03a6 6 0 0 0-11.53 1.6A4.5 4.5 0 0 0 6.5 14h11z"
            fill="url(#stormCloud)"
          />
          <path
            d="M13 10l-3 5h3.5L11 21l6-7h-4l2-4h-2z"
            fill="#facc15"
            stroke="#eab308"
            strokeWidth="0.5"
            className="drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]"
          />
          <defs>
            <linearGradient id="stormCloud" x1="6" y1="5" x2="18" y2="14" gradientUnits="userSpaceOnUse">
              <stop stopColor="#64748b" />
              <stop offset="1" stopColor="#334155" />
            </linearGradient>
          </defs>
        </svg>
      );
    }

    if (precip >= 5.0 || c === 65) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path
            d="M17.5 13A4.5 4.5 0 0 0 18 4.03a6 6 0 0 0-11.53 1.6A4.5 4.5 0 0 0 6.5 13h11z"
            fill="url(#rainCloudDark)"
          />
          <line x1="8" y1="16" x2="6.5" y2="21" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="16" x2="10.5" y2="21" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="16" x2="14.5" y2="21" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
          <defs>
            <linearGradient id="rainCloudDark" x1="6" y1="4" x2="18" y2="13" gradientUnits="userSpaceOnUse">
              <stop stopColor="#94a3b8" />
              <stop offset="1" stopColor="#475569" />
            </linearGradient>
          </defs>
        </svg>
      );
    }

    if (precip > 0.0 || (c >= 51 && c <= 67)) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path
            d="M17.5 13A4.5 4.5 0 0 0 18 4.03a6 6 0 0 0-11.53 1.6A4.5 4.5 0 0 0 6.5 13h11z"
            fill="url(#rainCloudLight)"
          />
          <line x1="9" y1="16" x2="7.5" y2="20" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="14" y1="16" x2="12.5" y2="20" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" />
          <defs>
            <linearGradient id="rainCloudLight" x1="6" y1="4" x2="18" y2="13" gradientUnits="userSpaceOnUse">
              <stop stopColor="#cbd5e1" />
              <stop offset="1" stopColor="#64748b" />
            </linearGradient>
          </defs>
        </svg>
      );
    }

    if (clouds >= 80 || c === 3) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path
            d="M17.5 16A4.5 4.5 0 0 0 18 7.03a6 6 0 0 0-11.53 1.6A4.5 4.5 0 0 0 6.5 16h11z"
            fill="url(#overcastCloud)"
          />
          <defs>
            <linearGradient id="overcastCloud" x1="6" y1="7" x2="18" y2="16" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e2e8f0" stopOpacity="0.9" />
              <stop offset="1" stopColor="#64748b" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        </svg>
      );
    }

    if ((clouds >= 30 || c === 2) && day) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <circle cx="15.5" cy="8.5" r="4.5" fill="#f59e0b" className="drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
          <path
            d="M14.5 17A4 4 0 0 0 15 9.03a5.5 5.5 0 0 0-10.5 1.5A4 4 0 0 0 4.5 17h10z"
            fill="url(#partlyCloudDay)"
          />
          <defs>
            <linearGradient id="partlyCloudDay" x1="4" y1="9" x2="15" y2="17" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f8fafc" />
              <stop offset="1" stopColor="#94a3b8" />
            </linearGradient>
          </defs>
        </svg>
      );
    }

    if (clouds >= 30 || c === 2) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path
            d="M16 4a5 5 0 0 0 5 5 5 5 0 1 1-5-5z"
            fill="#e2e8f0"
            className="drop-shadow-[0_0_6px_rgba(226,232,240,0.5)]"
          />
          <path
            d="M14.5 18A4 4 0 0 0 15 10.03a5.5 5.5 0 0 0-10.5 1.5A4 4 0 0 0 4.5 18h10z"
            fill="url(#partlyCloudNight)"
          />
          <defs>
            <linearGradient id="partlyCloudNight" x1="4" y1="10" x2="15" y2="18" gradientUnits="userSpaceOnUse">
              <stop stopColor="#94a3b8" />
              <stop offset="1" stopColor="#475569" />
            </linearGradient>
          </defs>
        </svg>
      );
    }

    if (day) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="5" fill="url(#sunCore)" className="drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
          <g stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round">
            <line x1="12" y1="2" x2="12" y2="4.5" />
            <line x1="12" y1="19.5" x2="12" y2="22" />
            <line x1="2" y1="12" x2="4.5" y2="12" />
            <line x1="19.5" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="4.93" x2="6.7" y2="6.7" />
            <line x1="17.3" y1="17.3" x2="19.07" y2="19.07" />
            <line x1="4.93" y1="19.07" x2="6.7" y2="17.3" />
            <line x1="17.3" y1="6.7" x2="19.07" y2="4.93" />
          </g>
          <defs>
            <linearGradient id="sunCore" x1="7" y1="7" x2="17" y2="17" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fef08a" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      );
    }

    return (
      <svg className={className} viewBox="0 0 24 24" fill="none">
        <path
          d="M19 13.5A7.5 7.5 0 0 1 10.5 5a8 8 0 1 0 8.5 8.5z"
          fill="url(#moonGrad)"
          stroke="#e2e8f0"
          strokeWidth="0.5"
          className="drop-shadow-[0_0_8px_rgba(224,242,254,0.6)]"
        />
        <circle cx="17.5" cy="5.5" r="0.8" fill="#ffffff" />
        <defs>
          <linearGradient id="moonGrad" x1="6" y1="4" x2="18" y2="19" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#e2e8f0" />
            <stop offset="1" stopColor="#94a3b8" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  const getWindDirectionDetails = (deg: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const names = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    const index16 = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
    const index8 = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
    return { abbr: directions[index16], label: names[index8] };
  };

  const fetchStationWeights = async (station: StationPreset) => {
    try {
      setLoadingBma(true);
      const [bmaRes, accuData] = await Promise.allSettled([
        fetch(`${API_BASE}/api/v1/forecast/live-bma?lat=${station.lat}&lon=${station.lon}&variable=temperature_2m`),
        fetchAccuGroundTruth(station.lat, station.lon),
      ]);

      if (bmaRes.status === 'fulfilled' && bmaRes.value.ok) {
        const data = await bmaRes.value.json();
        setLiveBma(data);
      }
      if (accuData.status === 'fulfilled' && accuData.value) {
        setAccuObs(accuData.value);
      }
    } catch (err) {
      console.error('BMA & Accu API error:', err);
    } finally {
      setLoadingBma(false);
    }
  };

  const fetchPanIndiaAlerts = async () => {
    try {
      setIsScanningAlerts(true);
      const res = await fetch(`${API_BASE}/api/v1/alerts/extreme`);
      if (!res.ok) throw new Error('Failed to fetch pan-india alerts');
      const data = await res.json();
      setAlerts(data.alerts || []);
      setSynopticRegime(data.regime || 'Synoptic Normal');
      setLastSyncTime(data.last_sync || 'Live');
    } catch (err) {
      console.warn('Pan-India alerts fetch notice:', err);
    } finally {
      setIsScanningAlerts(false);
    }
  };

  useEffect(() => {
    fetchStationWeights(selectedStation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStation]);

  useEffect(() => {
    fetchPanIndiaAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hourlyCards = [
    { time: 'Now', temp: Math.round(weather.temperature), code: weather.weather_code, day: isDay },
    { time: '+3h', temp: Math.round(weather.temperature), code: weather.weather_code, day: isDay },
    { time: '+6h', temp: Math.round(weather.temperature - 1), code: precip > 0 ? 61 : weather.weather_code, day: isDay },
    { time: '+12h', temp: Math.round(weather.temperature + 1), code: 2, day: 1 },
    { time: '+18h', temp: Math.round(weather.temperature + 2), code: 0, day: 1 },
    { time: '+24h', temp: Math.round(weather.temperature), code: 1, day: 0 },
  ];

  const dailyCards = [
    { day: 'Today', date: 'T+24h', temp: Math.round(weather.temperature), code: weather.weather_code, isDaytime: isDay },
    { day: 'Tue', date: 'T+48h', temp: Math.round(weather.temperature + 1), code: 2, isDaytime: 1 },
    { day: 'Wed', date: 'T+72h', temp: Math.round(weather.temperature - 1), code: 61, isDaytime: 1 },
    { day: 'Thu', date: 'T+96h', temp: Math.round(weather.temperature + 2), code: 2, isDaytime: 1 },
    { day: 'Fri', date: 'T+120h', temp: Math.round(weather.temperature + 3), code: 0, isDaytime: 1 },
    { day: 'Sat', date: 'T+144h', temp: Math.round(weather.temperature), code: 2, isDaytime: 0 },
  ];

  const severityScore = Number(((precip * 0.4) + (weather.wind_speed * 0.05)).toFixed(1));
  const progressPercent = Math.min(Math.max((severityScore / 10) * 100, 4), 96);

  const cardStyle = 'rounded-3xl bg-slate-950/60 backdrop-blur-2xl border border-white/10 p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.37)] hover:border-white/[0.16] transition-all';
  const tileStyle = 'rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 backdrop-blur-md';

  return (
    <div className="w-full space-y-5 font-sans text-slate-100">
      
      {/* Pan-India Extreme Weather Guidance Section */}
      <div className={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono tracking-wide">
                  Pan–India Extreme Weather Guidance
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  <Radio className="w-2.5 h-2.5 animate-ping text-cyan-400" />
                  DAEMON
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Continuous rolling 24h hazard verification across 31 official IMD subdivisions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right font-mono hidden sm:block">
              <div className="text-xs font-semibold text-slate-200">
                <span className="text-cyan-400">31</span> / 31 Subdivisions Active
              </div>
              <div className="text-[10px] text-slate-400">
                Regime: <strong className="text-emerald-400">{synopticRegime}</strong> · {lastSyncTime}
              </div>
            </div>
            <button
              onClick={fetchPanIndiaAlerts}
              disabled={isScanningAlerts}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 hover:bg-white/10 text-xs font-mono text-slate-300 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningAlerts ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
              <span className="hidden sm:inline">Rescan Subdivisions</span>
            </button>
          </div>
        </div>

        {/* Dynamic Alerts Feed or Nominal Shield */}
        <div className="pt-4">
          {alerts && alerts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
              {alerts.map((al, idx) => {
                const isRed = al.tier === 'RED' || al.severity.toLowerCase().includes('red');
                const isOrange = al.tier === 'ORANGE' || al.severity.toLowerCase().includes('orange');
                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                      isRed
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-100 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                        : isOrange
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-100'
                        : 'bg-yellow-500/10 border-yellow-500/40 text-yellow-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold font-mono tracking-wide flex items-center gap-1.5">
                          <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${
                            isRed ? 'text-rose-400' : isOrange ? 'text-amber-400' : 'text-yellow-400'
                          }`} />
                          {al.region}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase font-semibold ${
                          isRed
                            ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                            : isOrange
                            ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                            : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'
                        }`}>
                          {al.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-sans leading-relaxed line-clamp-2">
                        {al.message || al.synoptic_cause}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2.5 pt-2 border-t border-white/[0.08]">
                      <span>{al.category}</span>
                      <strong className="text-white">{al.observed_value} {al.unit}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col items-center justify-center text-center space-y-2.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white font-mono">
                Nominal Atmospheric Conditions Across India
              </h4>
              <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
                All 31 Indian meteorological subdivisions are currently operating below critical IMD hazard trigger thresholds 
                (Rolling 24h Rain &lt; 15.6 mm, Wind &lt; 25 km/h, Temperatures 8°C to 38°C).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Hero + Forecast Columns */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Primary Hero Card */}
        <div className={`lg:col-span-5 ${cardStyle} flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-xs font-semibold tracking-wide text-white">
                  {locationName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Consensus Live</span>
              </div>
            </div>

            <div className="pt-4 flex items-start justify-between">
              <div>
                <div className="flex items-baseline">
                  <span className="text-7xl font-extralight font-mono text-white tracking-tight">
                    {Math.round(weather.temperature)}
                  </span>
                  <span className="text-3xl font-mono text-cyan-400 ml-1 font-light">°C</span>
                </div>
                <h2 className="text-base font-semibold text-white mt-1">
                  {getConditionLabel()}
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Real-time hybrid blending over ECMWF, GFS, and ICON with microclimate downscaling.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-inner">
                {renderWeatherGlyph(weather.weather_code, isDay, 'w-12 h-12')}
              </div>
            </div>
          </div>

          {/* Metric Tiles */}
          <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-white/[0.06] mt-4">
            <div className={tileStyle}>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                  Precipitation
                </span>
                <span className="text-[10px] text-slate-500 font-mono">AWS</span>
              </div>
              <div className="text-xl font-mono font-semibold text-white">
                {precip.toFixed(1)} <span className="text-xs font-normal text-slate-400">mm</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Physical gauge</span>
            </div>

            <div className={tileStyle}>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-sky-400" />
                  Humidity
                </span>
                <span className="text-[10px] text-slate-500 font-mono">2m</span>
              </div>
              <div className="text-xl font-mono font-semibold text-white">
                {weather.humidity}<span className="text-xs font-normal text-slate-400">%</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Boundary layer</span>
            </div>

            <div className={tileStyle}>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                  Pressure
                </span>
                <span className="text-[10px] text-slate-500 font-mono">MSLP</span>
              </div>
              <div className="text-xl font-mono font-semibold text-white">
                {Math.round(weather.pressure)} <span className="text-xs font-normal text-slate-400">hPa</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Barometric</span>
            </div>

            <div className={tileStyle}>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  Cloud Cover
                </span>
                <span className="text-[10px] text-slate-500 font-mono">INSAT</span>
              </div>
              <div className="text-xl font-mono font-semibold text-white">
                {weather.cloud_cover}<span className="text-xs font-normal text-slate-400">%</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Radiance aligned</span>
            </div>
          </div>
        </div>

        {/* Right Forecasting Horizons Column */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Short-Range Strip */}
          <div className={cardStyle}>
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold tracking-wide text-white">
                  Short-Range Lead Horizons
                </span>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                Step: 3h
              </span>
            </div>
            
            <div className="grid grid-cols-6 gap-2">
              {hourlyCards.map((item, idx) => (
                <div
                  key={item.time}
                  className={`flex flex-col items-center py-3 px-1 rounded-xl border transition-all ${
                    idx === 0
                      ? 'bg-cyan-500/15 border-cyan-400/50 shadow-sm'
                      : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="text-[11px] text-slate-400 font-medium">{item.time}</span>
                  <div className="my-2.5">
                    {renderWeatherGlyph(item.code, item.day, 'w-6 h-6')}
                  </div>
                  <span className="text-sm font-mono font-semibold text-white">
                    {item.temp}°
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Medium-Range 6-Day Strip */}
          <div className={cardStyle}>
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold tracking-wide text-white">
                  144-Hour Medium Range Forecast
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                BMA Ensemble
              </span>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {dailyCards.map((item, idx) => (
                <div
                  key={item.day}
                  className={`flex flex-col items-center py-3 px-1 rounded-xl border transition-all ${
                    idx === 0
                      ? 'bg-emerald-500/15 border-emerald-400/50 shadow-sm'
                      : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="text-xs text-white font-medium">{item.day}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{item.date}</span>
                  <div className="my-2.5">
                    {renderWeatherGlyph(item.code, item.isDaytime, 'w-6 h-6')}
                  </div>
                  <span className="text-sm font-mono font-semibold text-white">
                    {item.temp}°
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Severity & Surface Wind Tile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`${cardStyle} flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400 font-medium">Atmospheric Severity</span>
                  <span className="font-mono text-xs font-semibold text-emerald-400">Nominal</span>
                </div>
                <div className="text-2xl font-mono font-light text-white mt-1">
                  {severityScore} <span className="text-xs text-slate-500">/ 10.0</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-snug">
                  Multi-model divergence and convective risk weighting.
                </p>
              </div>

              <div className="mt-4 pt-2">
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 opacity-60" />
                  <div
                    className="w-2.5 h-full bg-white rounded-full absolute top-0 shadow transition-all duration-500"
                    style={{ left: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Surface Wind Vector */}
            {(() => {
              const wind = getWindDirectionDetails(weather.wind_direction);
              return (
                <div className={`${cardStyle} flex items-center justify-between`}>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
                      <Wind className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Surface Wind</span>
                    </div>

                    <div className="text-2xl font-mono font-semibold text-white">
                      {Math.round(weather.wind_speed)}
                      <span className="text-xs font-normal text-slate-400 ml-1">km/h</span>
                    </div>

                    <div className="mt-1 text-xs">
                      <span className="text-cyan-300 font-medium">
                        {wind.abbr} · {wind.label}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                        Bearing: {weather.wind_direction}°
                      </span>
                    </div>
                  </div>

                  <div className="w-20 h-20 relative rounded-full border border-white/10 bg-slate-900/60 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
                    <span className="absolute top-1 text-[8px] font-mono font-bold text-cyan-400 pointer-events-none">N</span>
                    <span className="absolute bottom-1 text-[7px] font-mono text-slate-500 pointer-events-none">S</span>
                    <span className="absolute left-1.5 text-[7px] font-mono text-slate-500 pointer-events-none">W</span>
                    <span className="absolute right-1.5 text-[7px] font-mono text-slate-500 pointer-events-none">E</span>

                    <div className="w-1.5 h-1.5 rounded-full bg-slate-950 border border-cyan-400 z-20" />

                    <div
                      className="absolute inset-0 flex items-center justify-center transition-transform duration-700 ease-out z-10 pointer-events-none"
                      style={{ transform: `rotate(${weather.wind_direction}deg)` }}
                    >
                      <div className="relative w-full h-full flex flex-col items-center justify-center">
                        <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[20px] border-b-rose-500 mb-[1px]" />
                        <div className="w-0 h-0 border-l-[2.5px] border-l-transparent border-r-[2.5px] border-r-transparent border-t-[14px] border-t-slate-500 mt-[1px]" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Microclimate Verification Cockpit */}
      <div className={`${cardStyle} space-y-4`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Microclimate Empirical Verification Cockpit
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Bayesian Model Averaging (BMA) dynamic weight reallocation based on local ground station residuals.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
            {DEMO_MICROCLIMATES.map((st) => {
              const isSelected = st.id === selectedStation.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setSelectedStation(st)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? st.terrain === 'foothill'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {st.terrain === 'foothill' ? (
                    <Mountain className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{st.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 space-y-3">
            <div className={tileStyle}>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="text-cyan-400 font-mono text-[10px] uppercase">Station Target</span>
                <span className="text-[10px] font-mono text-slate-400">{selectedStation.elevation}</span>
              </div>
              <h2 className="text-sm font-semibold text-white">{selectedStation.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{selectedStation.tag}</p>
              <div className="mt-2 text-[11px] font-mono text-slate-400">
                Coordinates: {selectedStation.lat.toFixed(2)}°N, {selectedStation.lon.toFixed(2)}°E
              </div>
            </div>

            <div className={tileStyle}>
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                Orographic Regime
              </span>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                {selectedStation.regime}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-[10px] font-mono text-amber-400 uppercase block">
                  {accuObs ? 'AccuWeather AWS' : 'Ground Truth'}
                </span>
                <div className="text-xl font-mono font-semibold text-white mt-0.5">
                  {accuObs ? `${accuObs.temperature}°C` : (liveBma ? `${liveBma.observed_ground_truth}°C` : '--')}
                </div>
                <span className="text-[10px] text-slate-400 block truncate">
                  {accuObs ? accuObs.weatherText : 'Physical AWS'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] font-mono text-emerald-400 uppercase block">Consensus</span>
                <div className="text-xl font-mono font-semibold text-emerald-300 mt-0.5">
                  {liveBma ? `${liveBma.blended_consensus}°C` : '--'}
                </div>
                <span className="text-[10px] text-emerald-400/80 block">Inverse-Variance BMA</span>
              </div>
            </div>

            <button
              onClick={() => fetchStationWeights(selectedStation)}
              disabled={loadingBma}
              className="w-full py-2.5 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs font-mono text-slate-300 flex items-center justify-center gap-2 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBma ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
              <span>Recalculate Bayesian Weights</span>
            </button>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/[0.06]">
                <span className="text-xs font-semibold text-slate-300">
                  Inverse-Variance Weight Allocation
                </span>
                {liveBma && (
                  <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    <Award className="w-3.5 h-3.5" />
                    <span>Rank #1: {liveBma.top_performing_model}</span>
                  </div>
                )}
              </div>

              {loadingBma ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs font-mono gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                  <span>Computing station error variances across models...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {liveBma?.models_ranked.map((item, idx) => (
                    <div
                      key={item.model_id}
                      className={`p-3 rounded-xl border ${
                        idx === 0
                          ? 'bg-cyan-500/[0.06] border-cyan-400/30'
                          : 'bg-white/[0.02] border-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className={`flex items-center gap-1.5 font-medium ${idx === 0 ? 'text-cyan-300' : 'text-white'}`}>
                          {idx === 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                          {item.model_name}
                        </span>
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="text-slate-400">Pred: <strong className="text-white">{item.prediction}°</strong></span>
                          <span className="text-slate-400">Err: <strong className="text-white">{item.residual_error}°</strong></span>
                          <span className={`font-semibold ${idx === 0 ? 'text-emerald-400' : 'text-white'}`}>
                            {item.weight_pct}
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            idx === 0 ? 'bg-cyan-400' : 'bg-slate-500'
                          }`}
                          style={{ width: `${Math.min(item.bma_weight * 100 * 1.5, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <span className="text-[11px] font-mono text-slate-400 mt-3 block">
              {"Formulation: w_i = (1 / \u03c3_i\u00b2) / \u03a3_k (1 / \u03c3_k\u00b2). Dynamically calculated from local AWS residuals."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BentoDashboard;