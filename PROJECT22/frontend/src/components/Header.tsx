import React from 'react';
import { Cloud, Sun, CloudRain, Snowflake, Map, BarChart3, AlertTriangle, Activity, Layers, LocateIcon } from 'lucide-react';
import { WeatherMode } from '../utils/types';

interface HeaderProps {
  weatherMode: WeatherMode;
  onWeatherModeChange: (mode: WeatherMode) => void;
  activeTab: 'map' | 'weights' | 'alerts' | 'metrics' | 'models';
  onTabChange: (tab: 'map' | 'weights' | 'alerts' | 'metrics' | 'models') => void;
  getCurrentLocation?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  weatherMode,
  onWeatherModeChange,
  activeTab,
  onTabChange,
  getCurrentLocation,
}) => {
  const tabs = [
    { id: 'map' as const, label: 'Forecast Map', icon: Map },
    { id: 'weights' as const, label: 'Model Weights', icon: BarChart3 },
    { id: 'alerts' as const, label: 'Alerts', icon: AlertTriangle },
    { id: 'metrics' as const, label: 'Metrics', icon: Activity },
    { id: 'models' as const, label: 'Models', icon: Layers },
  ];

  const modeTooltips = {
    sun: 'Sunny / Clear weather mode',
    rain: 'Rainy / Precipitation weather mode',
    snow: 'Snow / Winter weather mode',
  };

  const handleLocationClick = () => {
    if (getCurrentLocation) {
      getCurrentLocation();
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Detected position:', position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  return (
    <header className="glass-card rounded-2xl p-4 md:p-6">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Cloud className="w-8 h-8 text-amber-400 animate-pulse" />
          <div>
            <h1 className="font-extrabold text-2xl tracking-wider gradient-text">ATMOS.</h1>
            <p className="text-xs text-slate-400">Dynamic AI-NWP Blending Platform</p>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => onWeatherModeChange('sun')}
            className={`p-2 rounded-lg transition-all ${
              weatherMode === 'sun'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-400 hover:bg-slate-700/50'
            }`}
            title={modeTooltips.sun}
          >
            <Sun className="w-5 h-5" />
          </button>
          <button
            onClick={() => onWeatherModeChange('rain')}
            className={`p-2 rounded-lg transition-all ${
              weatherMode === 'rain'
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-slate-400 hover:bg-slate-700/50'
            }`}
            title={modeTooltips.rain}
          >
            <CloudRain className="w-5 h-5" />
          </button>
          <button
            onClick={() => onWeatherModeChange('snow')}
            className={`p-2 rounded-lg transition-all ${
              weatherMode === 'snow'
                ? 'bg-indigo-500/20 text-indigo-300'
                : 'text-slate-400 hover:bg-slate-700/50'
            }`}
            title={modeTooltips.snow}
          >
            <Snowflake className="w-5 h-5" />
          </button>
          <button
            onClick={handleLocationClick}
            className="p-2 rounded-lg transition-all text-slate-400 hover:bg-slate-700/50"
            title="Use current location"
          >
            <LocateIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;