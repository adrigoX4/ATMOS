import React from 'react';
import { 
  Wind, 
  Droplets, 
  CloudRain, 
  Gauge, 
  Eye, 
  Compass, 
  Sun, 
  CloudSun, 
  Cloud, 
  CloudFog, 
  CloudLightning, 
  Snowflake 
} from 'lucide-react';
import type { Location } from '../../App';

interface WeatherCardProps {
  location: Location;
  weatherData: any;
  loading: boolean;
  error: string | null;
}

const getWeatherIcon = (code: number, isDay: boolean = true) => {
  if (code === 0) return Sun;
  if (code >= 1 && code <= 3) return CloudSun;
  if (code >= 45 && code <= 48) return CloudFog;
  if (code >= 51 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return Snowflake;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 85 && code <= 86) return Snowflake;
  if (code >= 95 && code <= 99) return CloudLightning;
  return Cloud;
};

const getWeatherDescription = (code: number): string => {
  const descriptions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return descriptions[code] || 'Scattered Clouds';
};

const WeatherCard: React.FC<WeatherCardProps> = ({
  location,
  weatherData,
  loading,
  error,
}) => {
  if (loading && !weatherData) {
    return (
      <div className="glass-card rounded-2xl p-6 min-h-[300px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading weather metrics...</p>
        </div>
      </div>
    );
  }

  if (error && !weatherData) {
    return (
      <div className="glass-card rounded-2xl p-6 min-h-[300px] flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  const current = weatherData?.current || {};

  // Normalize field lookups from either direct Open-Meteo or internal backend schemas
  const temp = Math.round(current.temperature ?? current.temperature_2m ?? 24);
  const feelsLike = Math.round(current.apparent_temperature ?? current.feels_like ?? temp);
  const humidity = Math.round(current.humidity ?? current.relative_humidity_2m ?? 60);
  const precip = Number(current.precipitation ?? current.rain ?? 0).toFixed(2);
  const pressure = Math.round(current.pressure ?? current.surface_pressure ?? current.pressure_msl ?? 1013);
  const cloudCover = Math.round(current.cloud_cover ?? current.cloudcover ?? 45);
  const windSpeed = Math.round(current.wind_speed ?? current.wind_speed_10m ?? 12);
  const windDir = Math.round(current.wind_direction ?? current.wind_direction_10m ?? 0);
  const weatherCode = Number(current.weather_code ?? current.weathercode ?? 0);
  const isDay = current.is_day !== undefined ? Boolean(current.is_day) : true;

  const WeatherIcon = getWeatherIcon(weatherCode, isDay);

  const getWindRisk = (speed: number) => {
    if (speed > 50) return { label: 'Severe', color: 'text-red-400' };
    if (speed > 30) return { label: 'Moderate', color: 'text-amber-400' };
    return { label: 'Low', color: 'text-emerald-400' };
  };

  const windRisk = getWindRisk(windSpeed);

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">{location.name}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {location.latitude.toFixed(2)}°N, {location.longitude.toFixed(2)}°E
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <WeatherIcon className="w-8 h-8 text-amber-400" />
          </div>
          <div className="text-right">
            <div className="text-4xl font-extrabold tracking-tight text-slate-100">
              {temp}°C
            </div>
            <p className="text-xs text-slate-400">Feels like {feelsLike}°C</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 px-1 border-t border-slate-800/80 pt-3">
        <span>Condition: <strong className="text-slate-200">{getWeatherDescription(weatherCode)}</strong></span>
        <span>Lead-time: <strong className="text-amber-400">Realtime</strong></span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Wind Speed & Heading */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs">Wind</span>
            <Wind className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-100">{windSpeed} <span className="text-xs font-normal text-slate-400">km/h</span></p>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Compass className="w-3 h-3 text-slate-400" style={{ transform: `rotate(${windDir}deg)` }} />
              {windDir}°
            </p>
          </div>
        </div>

        {/* Humidity */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs">Humidity</span>
            <Droplets className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-100">{humidity}%</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Relative humidity</p>
          </div>
        </div>

        {/* Precipitation */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs">Precipitation</span>
            <CloudRain className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-100">{precip} <span className="text-xs font-normal text-slate-400">mm</span></p>
            <p className="text-[11px] text-slate-400 mt-0.5">Accumulated</p>
          </div>
        </div>

        {/* Surface Pressure */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs">Surface Pressure</span>
            <Gauge className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-100">{pressure} <span className="text-xs font-normal text-slate-400">hPa</span></p>
            <p className="text-[11px] text-slate-400 mt-0.5">Barometric</p>
          </div>
        </div>

        {/* Cloud Cover */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs">Cloud Cover</span>
            <Eye className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-100">{cloudCover}%</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Sky coverage</p>
          </div>
        </div>

        {/* Wind Risk */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs">Wind Risk</span>
            <Wind className={`w-4 h-4 ${windRisk.color}`} />
          </div>
          <div>
            <p className={`text-lg font-bold ${windRisk.color}`}>{windRisk.label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Threshold level</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherCard;