import React from 'react';
import { Sun, Cloud, CloudRain, Moon, CloudMoon, CloudSun } from 'lucide-react';
import { WeatherMode } from '../../utils/types';

interface HourlyForecastProps {
  weatherMode: WeatherMode;
}

const hourlyData = [
  { time: '12 PM', temp: 24, icon: Sun, color: 'text-amber-400' },
  { time: '3 PM', temp: 26, icon: Sun, color: 'text-amber-400' },
  { time: '6 PM', temp: 22, icon: CloudSun, color: 'text-sky-300' },
  { time: '9 PM', temp: 18, icon: Moon, color: 'text-indigo-300' },
  { time: '12 AM', temp: 16, icon: CloudMoon, color: 'text-indigo-400' },
  { time: '3 AM', temp: 14, icon: Cloud, color: 'text-slate-300' },
  { time: '6 AM', temp: 15, icon: CloudSun, color: 'text-amber-300' },
  { time: '9 AM', temp: 20, icon: Sun, color: 'text-amber-400' },
];

const HourlyForecast: React.FC<HourlyForecastProps> = ({ weatherMode }) => {
  const getTempModifier = () => {
    switch (weatherMode) {
      case 'rain': return -10;
      case 'snow': return -26;
      default: return 0;
    }
  };

  const tempMod = getTempModifier();

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-xs uppercase text-slate-400 font-semibold tracking-wider mb-4">
        Hourly Forecast
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {hourlyData.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="flex-shrink-0 text-center glass-card px-4 py-3 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-all hover:scale-105"
            >
              <p className="text-xs text-slate-400">{item.time}</p>
              <Icon className={`w-5 h-5 ${item.color} my-2 mx-auto`} />
              <p className="font-semibold text-sm">{item.temp + tempMod}°</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HourlyForecast;
