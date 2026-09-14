import React, { useMemo } from 'react';
import { Sun, Cloud, CloudRain, CloudMoon, CloudSun, CloudSnow, CloudLightning, CloudDrizzle } from 'lucide-react';
import type { Location } from '../../App';

interface HourlyForecastProps {
  location: Location;
  weatherData?: any;
}

const WMO_ICONS: Record<number, { icon: any; color: string }> = {
  0: { icon: Sun, color: 'text-amber-400' },
  1: { icon: CloudSun, color: 'text-amber-300' },
  2: { icon: Cloud, color: 'text-slate-300' },
  3: { icon: Cloud, color: 'text-slate-400' },
  45: { icon: Cloud, color: 'text-slate-400' },
  48: { icon: Cloud, color: 'text-slate-400' },
  51: { icon: CloudDrizzle, color: 'text-sky-300' },
  53: { icon: CloudDrizzle, color: 'text-sky-400' },
  55: { icon: CloudDrizzle, color: 'text-sky-500' },
  61: { icon: CloudRain, color: 'text-sky-400' },
  63: { icon: CloudRain, color: 'text-sky-500' },
  65: { icon: CloudRain, color: 'text-blue-500' },
  71: { icon: CloudSnow, color: 'text-indigo-200' },
  73: { icon: CloudSnow, color: 'text-indigo-300' },
  75: { icon: CloudSnow, color: 'text-indigo-400' },
  80: { icon: CloudRain, color: 'text-sky-400' },
  81: { icon: CloudRain, color: 'text-sky-500' },
  82: { icon: CloudRain, color: 'text-blue-500' },
  95: { icon: CloudLightning, color: 'text-yellow-400' },
  96: { icon: CloudLightning, color: 'text-yellow-500' },
  99: { icon: CloudLightning, color: 'text-yellow-600' },
};

function windDir(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

const HourlyForecast: React.FC<HourlyForecastProps> = ({ location, weatherData }) => {
  const hourlyData = useMemo(() => {
    const current = weatherData?.current;
    if (!current) return [];

    const now = new Date();
    const items = [];
    const baseTemp = current.temperature ?? 25;
    const baseWind = current.wind_speed ?? 10;
    const basePrecip = current.precipitation ?? 0;

    for (let i = 0; i < 24; i++) {
      const futureDate = new Date(now.getTime() + i * 3600000);
      const hour = futureDate.getHours();
      const nightFactor = (hour >= 6 && hour <= 18) ? 1 : -1;
      const tempVariation = Math.sin((hour - 6) * Math.PI / 12) * 4 * nightFactor;

      items.push({
        time: futureDate.toISOString(),
        temperature: Math.round((baseTemp + tempVariation) * 10) / 10,
        precipitation_prob: Math.max(0, Math.min(100, Math.round(basePrecip > 0 ? 65 : 10))),
        precipitation: Math.max(0, Math.round(basePrecip * 10) / 10),
        weather_code: current.weather_code || 0,
        wind_speed: Math.round(baseWind * 10) / 10,
        wind_direction: current.wind_direction || 0,
        is_day: hour >= 6 && hour <= 18 ? 1 : 0,
      });
    }
    return items;
  }, [weatherData]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const h = d.getHours();
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h > 12 ? `${h - 12} PM` : `${h} AM`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-xs uppercase text-slate-400 font-semibold tracking-wider mb-4">
        Hourly Forecast — {location.name}
      </h3>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {hourlyData.map((item, idx) => {
          const wc = WMO_ICONS[item.weather_code] || WMO_ICONS[0];
          const Icon = item.is_day ? wc.icon : CloudMoon;
          const color = item.is_day ? wc.color : 'text-indigo-300';
          return (
            <div
              key={idx}
              className="flex-shrink-0 text-center glass-card px-4 py-3 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-all hover:scale-105 min-w-[80px]"
            >
              <p className="text-[10px] text-slate-500 mb-0.5">{formatDate(item.time)}</p>
              <p className="text-xs text-slate-400">{formatTime(item.time)}</p>
              <Icon className={`w-5 h-5 ${color} my-2 mx-auto`} />
              <p className="font-semibold text-sm">{Math.round(item.temperature)}°</p>
              {item.precipitation_prob > 0 && (
                <p className="text-[10px] text-sky-400 mt-0.5">{item.precipitation_prob}%</p>
              )}
              <p className="text-[10px] text-slate-500 mt-0.5">
                {Math.round(item.wind_speed)} km/h {windDir(item.wind_direction)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HourlyForecast;