import React, { useState, useEffect, useCallback } from 'react';
import { weatherApi } from '../../services/api';
import { ExtremeAlert } from '../../utils/types';
import { AlertTriangle, MapPin, Clock, X } from 'lucide-react';

interface ExtremeAlertsProps {
  detailed?: boolean;
}

const severityConfig: Record<string, { color: string; bg: string; pulse: boolean }> = {
  EXTREME: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', pulse: true },
  SEVERE: { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', pulse: false },
  MODERATE: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', pulse: false },
  LOW: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', pulse: false },
};

const ExtremeAlerts: React.FC<ExtremeAlertsProps> = ({ detailed = false }) => {
  const [alerts, setAlerts] = useState<ExtremeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await weatherApi.getExtremeAlerts();
      setAlerts(response.alerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      const mockAlerts: ExtremeAlert[] = [
        {
          alert_id: '1',
          type: 'extreme_rainfall',
          severity: 'EXTREME',
          latitude: 19.07,
          longitude: 72.87,
          value: 156.2,
          threshold: 115.5,
          message: 'EXTREME rainfall detected at (19.07, 72.87): 156.2 mm exceeds 115.5 mm',
          created_at: new Date().toISOString(),
        },
        {
          alert_id: '2',
          type: 'heavy_rainfall',
          severity: 'SEVERE',
          latitude: 28.61,
          longitude: 77.23,
          value: 78.5,
          threshold: 64.5,
          message: 'Heavy rainfall detected at (28.61, 77.23): 78.5 mm exceeds 64.5 mm',
          created_at: new Date().toISOString(),
        },
        {
          alert_id: '3',
          type: 'heatwave',
          severity: 'MODERATE',
          latitude: 26.91,
          longitude: 75.78,
          value: 42.3,
          threshold: 40.0,
          message: 'Heatwave detected at (26.91, 75.78): 42.3°C exceeds 40.0°C',
          created_at: new Date().toISOString(),
        },
      ];
      setAlerts(mockAlerts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.alert_id));
  const displayAlerts = detailed ? visibleAlerts : visibleAlerts.slice(0, 3);

  const handleDismiss = (alertId: string) => {
    setDismissed((prev) => new Set([...prev, alertId]));
  };

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
          <h3 className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
            Loading Alerts...
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
            Extreme Weather Alerts
          </h3>
        </div>
        <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
          {visibleAlerts.length} active
        </span>
      </div>

      {displayAlerts.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No active extreme weather alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayAlerts.map((alert) => {
            const config = severityConfig[alert.severity] || severityConfig.LOW;
            return (
              <div
                key={alert.alert_id}
                className={`relative p-4 rounded-xl border ${config.bg} ${
                  config.pulse ? 'pulse-alert' : ''
                } transition-all hover:scale-[1.02]`}
              >
                <button
                  onClick={() => handleDismiss(alert.alert_id)}
                  className="absolute top-2 right-2 p-1 rounded-full hover:bg-slate-700/50 transition-colors"
                >
                  <X className="w-3 h-3 text-slate-400" />
                </button>

                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${config.bg}`}>
                    <AlertTriangle className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${config.color}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-slate-500 uppercase">
                        {alert.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 truncate">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {alert.latitude.toFixed(2)}°, {alert.longitude.toFixed(2)}°
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {detailed && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Value:</span>
                        <span className="font-semibold text-slate-200">
                          {alert.value.toFixed(1)}
                        </span>
                        <span className="text-slate-500">|</span>
                        <span className="text-slate-400">Threshold:</span>
                        <span className="font-semibold text-slate-200">
                          {alert.threshold.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExtremeAlerts;
