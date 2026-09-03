import React, { useEffect, useState } from 'react';
import { MapPin, Wind, Droplets, Sun, Thermometer, CloudRain, Snowflake } from 'lucide-react';
import { WeatherMode } from '../../utils/types';

interface WeatherCardProps {
  weatherMode: WeatherMode;
  variable: string;
  leadTime: number;
}

const weatherPresets = {
  sun: {
    temp: '24°',
    condition: 'Clear Sky',
    wind: '12',
    humidity: '48',
    uv: '6',
    uvLabel: 'High',
    bg: '#38bdf822',
    location: 'New Delhi, India',
    icon: <Sun className="w-24 h-24 text-amber-400 drop-shadow-[0_0_25px_rgba(251,191,36,0.6)]" />,
  },
  rain: {
    temp: '14°',
    condition: 'Heavy Rain',
    wind: '28',
    humidity: '92',
    uv: '1',
    uvLabel: 'Low',
    bg: '#0284c722',
    location: 'Mumbai, India',
    icon: <CloudRain className="w-24 h-24 text-sky-400 drop-shadow-[0_0_25px_rgba(56,189,248,0.5)]" />,
  },
  snow: {
    temp: '-2°',
    condition: 'Snowfall',
    wind: '8',
    humidity: '75',
    uv: '0',
    uvLabel: 'Low',
    bg: '#818cf822',
    location: 'Srinagar, India',
    icon: <Snowflake className="w-24 h-24 text-indigo-200 drop-shadow-[0_0_25px_rgba(199,210,254,0.6)]" />,
  },
};

const WeatherCard: React.FC<WeatherCardProps> = ({ weatherMode, variable, leadTime }) => {
  const [currentTemp, setCurrentTemp] = useState(24);
  const preset = weatherPresets[weatherMode];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTemp((prev) => prev + (Math.random() > 0.5 ? 0.1 : -0.1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-card rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 20%, ${preset.bg}, transparent 70%)`,
          }}
        />
      </div>

      <div className="relative z-10">
        <div className="relative w-32 h-32 mb-4 mx-auto flex items-center justify-center">
          {preset.icon}
        </div>

        <h1 className="text-7xl md:text-8xl font-black tracking-tight my-2 gradient-text">
          {preset.temp}
        </h1>
        <p className="text-xl md:text-2xl font-medium text-slate-300 uppercase tracking-widest mb-1">
          {preset.condition}
        </p>
        <p className="text-sm text-slate-400 flex items-center justify-center gap-1 mb-6">
          <MapPin className="w-4 h-4 text-rose-400" />
          {preset.location}
        </p>

        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          <div className="glass-card rounded-xl p-4 hover:-translate-y-1 transition-transform">
            <Wind className="w-6 h-6 text-sky-400 mx-auto mb-2" />
            <p className="text-xl font-bold">{preset.wind}</p>
            <p className="text-xs text-slate-400">km/h</p>
          </div>
          <div className="glass-card rounded-xl p-4 hover:-translate-y-1 transition-transform">
            <Droplets className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-xl font-bold">{preset.humidity}%</p>
            <p className="text-xs text-slate-400">Humidity</p>
          </div>
          <div className="glass-card rounded-xl p-4 hover:-translate-y-1 transition-transform">
            <Sun className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-xl font-bold">{preset.uv}</p>
            <p className="text-xs text-amber-400 px-2 py-0.5 rounded-full bg-amber-400/10">
              {preset.uvLabel}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-slate-400">
          <span className="px-3 py-1 rounded-lg bg-slate-800/50 border border-slate-700/50">
            Variable: {variable.toUpperCase()}
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-800/50 border border-slate-700/50">
            Lead Time: {leadTime}h
          </span>
        </div>
      </div>
    </div>
  );
};

export default WeatherCard;
