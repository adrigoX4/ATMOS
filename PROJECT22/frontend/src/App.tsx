import React, { useState } from 'react';
import Header from './components/Header';
import WeatherMap from './components/map/WeatherMap';
import WeatherCard from './components/weather/WeatherCard';
import HourlyForecast from './components/weather/HourlyForecast';
import ModelWeights from './components/dashboard/ModelWeights';
import ExtremeAlerts from './components/alerts/ExtremeAlerts';
import MetricCharts from './components/dashboard/MetricCharts';
import { WeatherMode } from './utils/types';

const App: React.FC = () => {
  const [weatherMode, setWeatherMode] = useState<WeatherMode>('sun');
  const [selectedVariable, setSelectedVariable] = useState<string>('tp');
  const [selectedLeadTime, setSelectedLeadTime] = useState<number>(24);
  const [activeTab, setActiveTab] = useState<'map' | 'weights' | 'alerts' | 'metrics'>('map');

  return (
    <div className="min-h-screen p-4 md:p-8">
      <Header
        weatherMode={weatherMode}
        onWeatherModeChange={setWeatherMode}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="max-w-7xl mx-auto mt-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <WeatherCard
              weatherMode={weatherMode}
              variable={selectedVariable}
              leadTime={selectedLeadTime}
            />
          </div>
          <div className="lg:col-span-1 space-y-4">
            <ExtremeAlerts />
          </div>
        </div>

        {activeTab === 'map' && (
          <WeatherMap
            variable={selectedVariable}
            leadTime={selectedLeadTime}
            onVariableChange={setSelectedVariable}
            onLeadTimeChange={setSelectedLeadTime}
          />
        )}

        {activeTab === 'weights' && (
          <ModelWeights
            variable={selectedVariable}
            leadTime={selectedLeadTime}
          />
        )}

        {activeTab === 'alerts' && (
          <ExtremeAlerts detailed />
        )}

        {activeTab === 'metrics' && (
          <MetricCharts variable={selectedVariable} />
        )}

        <HourlyForecast weatherMode={weatherMode} />
      </main>
    </div>
  );
};

export default App;
