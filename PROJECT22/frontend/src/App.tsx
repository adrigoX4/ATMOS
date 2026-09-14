import React, { useState, useEffect, useCallback } from 'react';
import { SidebarDock, TabType } from './components/SidebarDock';
import WeatherBackground from './components/WeatherBackground';
import BentoDashboard from './components/BentoDashboard';
import WeatherMap from './components/map/WeatherMap';
import ModelWeights from './components/dashboard/ModelWeights';
import MetricCharts from './components/dashboard/MetricCharts';
import ModelsPanel from './components/dashboard/ModelsPanel';
import ExtremeAlerts from './components/alerts/ExtremeAlerts';
import {
  Mountain,
  Flame,
  Compass,
  Radio,
  Clock,
  CloudRain,
  CheckCircle2,
  Wind,
  Zap,
} from 'lucide-react';

export interface Location {
  latitude: number;
  longitude: number;
  name: string;
}

const DEFAULT_LOCATION: Location = {
  latitude: 28.6139,
  longitude: 77.209,
  name: 'New Delhi (NCR)',
};

const PRESET_LOCATIONS: Location[] = [
  {
    latitude: 30.01,
    longitude: 77.76,
    name: 'Quantum University',
  },
  {
    latitude: 26.91,
    longitude: 70.91,
    name: 'Jaisalmer',
  },
];

export interface NowcastAlert {
  category: 'thunderstorm' | 'rain' | 'wind' | 'heat' | 'fog' | 'stable';
  severity: 'warning' | 'advisory' | 'watch' | 'normal';
  title: string;
  message: string;
  onsetHours?: number;
  expectedTime?: string;
  metricLabel?: string;
  metricValue?: string;
}

const App: React.FC = () => {
  const [selectedVariable, setSelectedVariable] = useState<string>('precipitation');
  const [selectedLeadTime, setSelectedLeadTime] = useState<number>(24);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedLocation, setSelectedLocation] = useState<Location>(DEFAULT_LOCATION);

  const [sharedWeather, setSharedWeather] = useState<any>(null);
  const [, setWeatherLoading] = useState<boolean>(true);
  const [nowcastAlert, setNowcastAlert] = useState<NowcastAlert | null>(null);

  // Live Precision Clock (Ticks every 1,000ms)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatLocalTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const formatLocalDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const formatZuluTime = (d: Date) => {
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}Z`;
  };

  // Convective Alert & Multi-Hazard Real-Time Engine
  const computeNowcastAlert = (current: any, hourly: any) => {
    const now = new Date();
    const currentHour = now.getHours();

    const curPrecip = Number(current?.precipitation) || 0;
    const curCode = Number(current?.weather_code) || 0;
    const curWind = Number(current?.wind_speed_10m ?? current?.wind_speed) || 0;

    if (curCode >= 95) {
      setNowcastAlert({
        category: 'thunderstorm',
        severity: 'warning',
        title: 'Severe Convective Thunderstorm',
        message: 'Active electrical discharges and microburst activity detected in this sector.',
        metricLabel: 'WMO Index',
        metricValue: `Code ${curCode}`,
      });
      return;
    }

    if (curPrecip >= 0.2 || (curCode >= 51 && curCode <= 67)) {
      setNowcastAlert({
        category: 'rain',
        severity: curPrecip >= 5 ? 'warning' : 'advisory',
        title: 'Precipitation Ongoing',
        message: `Active precipitation observed at station (~${curPrecip.toFixed(1)} mm/h).`,
        metricLabel: 'Rate',
        metricValue: `${curPrecip.toFixed(1)} mm/h`,
      });
      return;
    }

    if (hourly?.time?.length > 0) {
      for (let step = 1; step <= 12; step++) {
        const futureCode = hourly.weather_code?.[step] || 0;
        if (futureCode >= 95) {
          const timeStr = `${String((currentHour + step) % 24).padStart(2, '0')}:00`;
          setNowcastAlert({
            category: 'thunderstorm',
            severity: 'warning',
            title: `Thunderstorm projected in ~${step}h`,
            message: `Convective squall expected near ${timeStr} with localized lightning and gusts.`,
            onsetHours: step,
            expectedTime: timeStr,
            metricLabel: 'Onset',
            metricValue: `T+${step}h`,
          });
          return;
        }
      }

      for (let step = 1; step <= 12; step++) {
        const p = hourly.precipitation?.[step] || 0;
        const code = hourly.weather_code?.[step] || 0;
        const prob = hourly.precipitation_probability?.[step] ?? 0;

        if (p >= 0.1 || (code >= 51 && code <= 67)) {
          const timeStr = `${String((currentHour + step) % 24).padStart(2, '0')}:00`;
          setNowcastAlert({
            category: 'rain',
            severity: p >= 4.0 ? 'warning' : 'advisory',
            title: `Rain expected in ~${step} hour${step > 1 ? 's' : ''}`,
            message: `Approaching precipitation cloud mass will arrive around ${timeStr}. Estimated rate: ~${p.toFixed(1)} mm/h${prob > 0 ? ` (${prob}% probability)` : ''}.`,
            metricLabel: 'Expected',
            metricValue: `~${p.toFixed(1)} mm/h`,
          });
          return;
        }
      }

      for (let step = 1; step <= 12; step++) {
        const w = hourly.wind_speed_10m?.[step] || 0;
        if (w >= 18) {
          const timeStr = `${String((currentHour + step) % 24).padStart(2, '0')}:00`;
          setNowcastAlert({
            category: 'wind',
            severity: w >= 25 ? 'warning' : 'advisory',
            title: `Breezy wind shift in ~${step}h`,
            message: `Surface wind acceleration near ${timeStr}, peaking around ${Math.round(w)} km/h.`,
            metricLabel: 'Peak Gust',
            metricValue: `${Math.round(w)} km/h`,
          });
          return;
        }
      }

      for (let step = 1; step <= 12; step++) {
        const t = hourly.temperature_2m?.[step] || 0;
        if (t >= 36) {
          const timeStr = `${String((currentHour + step) % 24).padStart(2, '0')}:00`;
          setNowcastAlert({
            category: 'heat',
            severity: 'advisory',
            title: `Elevated heat expected near ~${timeStr}`,
            message: `Diurnal warming reaching peak surface temperature of ${t.toFixed(1)}°C.`,
            metricLabel: 'Peak',
            metricValue: `${t.toFixed(1)}°C`,
          });
          return;
        }
      }
    }

    if (curWind >= 18) {
      setNowcastAlert({
        category: 'wind',
        severity: 'advisory',
        title: 'Moderate surface wind',
        message: `Sustained surface winds of ${Math.round(curWind)} km/h recorded at station.`,
        metricLabel: 'Current',
        metricValue: `${Math.round(curWind)} km/h`,
      });
      return;
    }

    setNowcastAlert({
      category: 'stable',
      severity: 'normal',
      title: 'Stable atmospheric conditions',
      message: 'Zero precipitation, convective squalls, or extreme shear projected over the next 12 hours.',
      metricLabel: 'Status',
      metricValue: 'Nominal',
    });
  };

  const fetchGlobalWeather = useCallback(async (lat: number, lon: number) => {
    try {
      setWeatherLoading(true);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,is_day&hourly=precipitation,precipitation_probability,weather_code,temperature_2m,wind_speed_10m,relative_humidity_2m&forecast_days=2&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch telemetry');
      const data = await res.json();

      if (data?.current) {
        setSharedWeather({
          current: {
            temperature: data.current.temperature_2m ?? 28,
            apparent_temperature: data.current.apparent_temperature ?? data.current.temperature_2m ?? 28,
            humidity: data.current.relative_humidity_2m ?? 60,
            precipitation: data.current.precipitation ?? 0.0,
            weather_code: data.current.weather_code ?? 0,
            cloud_cover: data.current.cloud_cover ?? 20,
            pressure: data.current.surface_pressure ?? 1012,
            wind_speed: data.current.wind_speed_10m ?? 12,
            wind_direction: data.current.wind_direction_10m ?? 180,
            is_day: data.current.is_day ?? 1,
          },
          hourly: data.hourly,
          latitude: lat,
          longitude: lon,
        });
        computeNowcastAlert(data.current, data.hourly);
      }
    } catch (err) {
      console.error(err);
      setSharedWeather({
        current: {
          temperature: 29.4,
          apparent_temperature: 31.0,
          humidity: 62,
          precipitation: 0.0,
          weather_code: 1,
          cloud_cover: 25,
          pressure: 1009,
          wind_speed: 14.5,
          wind_direction: 110,
          is_day: 1,
        },
        latitude: lat,
        longitude: lon,
      });
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalWeather(selectedLocation.latitude, selectedLocation.longitude);
  }, [selectedLocation.latitude, selectedLocation.longitude, fetchGlobalWeather]);

  const isDashboardTab = activeTab === 'dashboard';
  const isJaisalmer = selectedLocation.name.toLowerCase().includes('jaisalmer');

  return (
    <div className="min-h-screen bg-transparent text-slate-100 relative overflow-x-hidden flex font-sans selection:bg-cyan-500/30">
      <WeatherBackground
        weatherCode={sharedWeather?.current?.weather_code ?? 0}
        precipitation={sharedWeather?.current?.precipitation ?? 0}
        cloudCover={sharedWeather?.current?.cloud_cover ?? 20}
        isDay={sharedWeather?.current?.is_day ?? 0}
        windSpeed={sharedWeather?.current?.wind_speed ?? 10}
        windDirection={sharedWeather?.current?.wind_direction ?? 180}
        isArid={isJaisalmer}
      />

      <SidebarDock
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onBack={() => setActiveTab('dashboard')}
      />

      <main className="flex-1 ml-24 mr-6 my-6 max-w-7xl relative z-10 space-y-4">
        
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
              <h1 className="text-2xl font-bold tracking-wider font-mono text-white">
                ATMOS <span className="text-cyan-400 font-semibold">AI</span>
              </h1>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px]">
                MoES · NCMRWF #26081
              </span>
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-[11px]">
                <Radio className="w-3 h-3 text-cyan-400" />
                <span>BMA Ingestion Active</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/40 border border-white/10 backdrop-blur-xl text-xs font-mono text-slate-300 shadow-sm">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-white tracking-wide">{formatLocalTime(currentTime)}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">{formatLocalDate(currentTime)}</span>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-400 font-medium">{formatZuluTime(currentTime)}</span>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/40 border border-white/10 backdrop-blur-xl text-xs">
              <button
                onClick={() => setSelectedLocation(PRESET_LOCATIONS[0])}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedLocation.name.includes('Quantum')
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mountain className="w-3 h-3" />
                <span>Quantum</span>
              </button>
              <button
                onClick={() => setSelectedLocation(PRESET_LOCATIONS[1])}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedLocation.name.includes('Jaisalmer')
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>Jaisalmer</span>
              </button>
            </div>

            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/40 border border-white/10 backdrop-blur-xl text-xs font-medium text-slate-300">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>{selectedLocation.name}</span>
            </div>
          </div>
        </div>

        {/* Real-Time Nowcast Banner */}
        {nowcastAlert && (
          <div
            className={`rounded-2xl p-3.5 border backdrop-blur-2xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg ${
              nowcastAlert.category === 'thunderstorm'
                ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                : nowcastAlert.category === 'rain'
                ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-200'
                : nowcastAlert.category === 'wind'
                ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                : nowcastAlert.category === 'heat'
                ? 'bg-orange-950/30 border-orange-500/30 text-orange-200'
                : 'bg-slate-950/40 border-white/10 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  nowcastAlert.category === 'thunderstorm'
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : nowcastAlert.category === 'rain'
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                    : nowcastAlert.category === 'wind'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {nowcastAlert.category === 'thunderstorm' && <Zap className="w-4 h-4" />}
                {nowcastAlert.category === 'rain' && <CloudRain className="w-4 h-4" />}
                {nowcastAlert.category === 'wind' && <Wind className="w-4 h-4" />}
                {nowcastAlert.category === 'stable' && <CheckCircle2 className="w-4 h-4" />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white font-semibold">
                    {nowcastAlert.severity}
                  </span>
                  <h2 className="text-sm font-semibold text-white tracking-wide">
                    {nowcastAlert.title}
                  </h2>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-normal">
                  {nowcastAlert.message}
                </p>
              </div>
            </div>

            {nowcastAlert.metricLabel && (
              <div className="flex items-center gap-2 self-end md:self-center px-3 py-1 rounded-xl bg-black/30 border border-white/10 font-mono text-xs text-slate-300">
                <span className="text-slate-400 text-[11px]">{nowcastAlert.metricLabel}:</span>
                <span className="font-semibold text-white">{nowcastAlert.metricValue}</span>
              </div>
            )}
          </div>
        )}

        {/* Bento Dashboard Container */}
        <div
          className={`space-y-4 transition-all duration-300 ${
            isDashboardTab
              ? 'block opacity-100 translate-y-0'
              : 'absolute -left-[99999px] top-0 opacity-0 pointer-events-none'
          }`}
          style={!isDashboardTab ? { width: '100%', maxWidth: '1280px' } : undefined}
        >
          {sharedWeather?.current && (
            <BentoDashboard
              weather={sharedWeather.current}
              locationName={selectedLocation.name}
            />
          )}

          <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 backdrop-blur-2xl">
            <WeatherMap
              variable={selectedVariable}
              leadTime={selectedLeadTime}
              onVariableChange={setSelectedVariable}
              onLeadTimeChange={setSelectedLeadTime}
              onLocationSelect={setSelectedLocation}
              selectedLocation={selectedLocation}
              isActive={isDashboardTab}
            />
          </div>
        </div>

        {/* Dynamic Model Weights Tab (Passes active location and real-time weather code) */}
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            <ModelWeights
              variable={selectedVariable}
              leadTime={selectedLeadTime}
              location={selectedLocation}
              weatherCode={sharedWeather?.current?.weather_code ?? 0}
            />
            <MetricCharts variable={selectedVariable} />
          </div>
        )}

        {activeTab === 'globe' && <ModelsPanel />}

        {activeTab === 'forecast' && (
          <div className="max-w-4xl mx-auto">
            <ExtremeAlerts
              detailed={true}
              onAlertSelect={(lat, lon) => {
                setSelectedLocation({
                  latitude: lat,
                  longitude: lon,
                  name: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
                });
                setActiveTab('dashboard');
              }}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-6 rounded-2xl bg-slate-950/40 border border-white/10 backdrop-blur-2xl text-slate-300 space-y-4">
            <h2 className="text-lg font-semibold text-white tracking-tight">
              MoES-NCMRWF Blending Optimization Engine
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Inverse-variance empirical skill weighting, Bayesian Model Averaging (BMA), and sub-grid orographic lapse-rate downscaling calibrated for Indian meteorological regimes.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;