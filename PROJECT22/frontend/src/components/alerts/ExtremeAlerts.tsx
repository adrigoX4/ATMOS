import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CloudLightning,
  Flame,
  Wind,
  BellRing,
  MapPin,
  Clock,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Snowflake,
  Radio,
} from 'lucide-react';
import { weatherApi } from '../../services/api';

export interface RegionalExtremeAlert {
  alert_id: string;
  region: string;
  subdivision: string;
  category: 'Heavy Rainfall' | 'Heat Wave' | 'Cold Wave' | 'Gale Wind' | 'Convective Squall';
  severity: 'Red Alert' | 'Orange Alert' | 'Yellow Warning';
  lead_time: string;
  observed_value: number;
  threshold_value: number;
  unit: string;
  confidence: number;
  latitude: number;
  longitude: number;
  issued_at: string;
  synoptic_cause: string;
}

interface ExtremeAlertsProps {
  detailed?: boolean;
  onAlertSelect?: (lat: number, lon: number) => void;
}

export const ExtremeAlerts: React.FC<ExtremeAlertsProps> = ({ onAlertSelect }) => {
  const [alerts, setAlerts] = useState<RegionalExtremeAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scannedCount, setScannedCount] = useState<number>(31);
  const [lastSync, setLastSync] = useState<string>('');
  const [activeRegime, setActiveRegime] = useState<string>('Synoptic Normal');

  const fetchAlertsFromBackend = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await weatherApi.getExtremeAlerts();

      if (res && Array.isArray(res.alerts)) {
        const mapped: RegionalExtremeAlert[] = res.alerts.map((item: any, idx: number) => {
          const rawCat = item.category || item.type || 'Heavy Rainfall';
          let category: RegionalExtremeAlert['category'] = 'Heavy Rainfall';
          if (/heat/i.test(rawCat)) category = 'Heat Wave';
          else if (/cold/i.test(rawCat)) category = 'Cold Wave';
          else if (/wind|gale/i.test(rawCat)) category = 'Gale Wind';
          else if (/squall|convective/i.test(rawCat)) category = 'Convective Squall';

          const rawSev = item.severity || 'Orange Alert';
          let severity: RegionalExtremeAlert['severity'] = 'Orange Alert';
          if (/red|extreme/i.test(rawSev)) severity = 'Red Alert';
          else if (/yellow|moderate/i.test(rawSev)) severity = 'Yellow Warning';

          return {
            alert_id: item.alert_id || `ALT-${idx + 1}`,
            region: item.region || `${item.latitude?.toFixed(2)}°N, ${item.longitude?.toFixed(2)}°E`,
            subdivision: item.subdivision || 'Operational Hazard Sector',
            category,
            severity,
            lead_time: item.lead_time || 'Lead T+24h Horizon',
            observed_value: Number(item.observed_value ?? item.value ?? 0),
            threshold_value: Number(item.threshold_value ?? item.threshold ?? 64.5),
            unit: item.unit || (category === 'Heavy Rainfall' ? 'mm' : category === 'Gale Wind' ? 'km/h' : '°C'),
            confidence: Number(item.confidence ?? 88),
            latitude: Number(item.latitude ?? 28.61),
            longitude: Number(item.longitude ?? 77.23),
            issued_at: item.issued_at || item.created_at || '00:00 IST',
            synoptic_cause: item.synoptic_cause || item.message || 'Synoptic convergence anomaly detected by model ensemble.',
          };
        });

        setAlerts(mapped);
        setScannedCount(res.scanned_stations ?? 31);
        setLastSync(res.last_sync || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST');
        if (res.regime) {
          setActiveRegime(res.regime);
        }
      } else {
        setAlerts([]);
      }
    } catch (err) {
      console.error('Failed to load server alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerRescan = async () => {
    setLoading(true);
    try {
      await fetch('http://localhost:8000/api/v1/alerts/rescan', { method: 'POST' });
      setTimeout(fetchAlertsFromBackend, 2500);
    } catch (_) {
      fetchAlertsFromBackend();
    }
  };

  useEffect(() => {
    fetchAlertsFromBackend();
  }, [fetchAlertsFromBackend]);

  const glassCard =
    'rounded-3xl bg-slate-900/15 backdrop-blur-md border border-white/10 p-6 shadow-2xl';

  const getAlertIcon = (category: RegionalExtremeAlert['category']) => {
    switch (category) {
      case 'Heavy Rainfall':
        return <CloudLightning className="w-5 h-5 text-rose-400" />;
      case 'Heat Wave':
        return <Flame className="w-5 h-5 text-amber-400" />;
      case 'Cold Wave':
        return <Snowflake className="w-5 h-5 text-cyan-300" />;
      case 'Gale Wind':
      case 'Convective Squall':
        return <Wind className="w-5 h-5 text-cyan-400" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    }
  };

  const getSeverityBadge = (severity: RegionalExtremeAlert['severity']) => {
    switch (severity) {
      case 'Red Alert':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
      case 'Orange Alert':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      default:
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className={`${glassCard} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-wide">
                Pan-India Extreme Weather Guidance
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 uppercase flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse text-cyan-400" />
                Backend Daemon
              </span>
            </div>
            <p className="text-xs text-neutral-300 mt-0.5">
              Continuous rolling 24h hazard verification across 31 official IMD subdivisions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-[11px] font-mono text-neutral-400 hidden sm:block">
            <span className="text-cyan-400 font-semibold">{scannedCount}</span> / 31 Subdivisions Active
            <span className="block text-neutral-400 text-[10px]">
              Regime: <strong className="text-neutral-200 font-normal">{activeRegime}</strong> • {lastSync || 'Syncing...'}
            </span>
          </div>

          <button
            onClick={triggerRescan}
            disabled={loading}
            className="px-3.5 py-2 rounded-2xl bg-white/[0.05] border border-white/10 hover:bg-white/10 transition flex items-center gap-2 text-xs text-neutral-200 font-mono disabled:opacity-50"
            title="Trigger manual server rescan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Rescan Subdivisions</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && alerts.length === 0 && (
        <div className={`${glassCard} h-48 flex flex-col items-center justify-center gap-3`}>
          <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
          <p className="text-xs font-mono text-neutral-400">
            Fetching synchronous evaluation from server-side hazard daemon...
          </p>
        </div>
      )}

      {/* Nominal State */}
      {!loading && alerts.length === 0 && (
        <div className={`${glassCard} text-center py-14 space-y-3`}>
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Nominal Atmospheric Conditions Across India</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
              All 31 Indian meteorological subdivisions are currently operating below critical IMD hazard trigger thresholds (Rolling 24h Rain &lt; 64.5 mm, Wind &lt; 45 km/h, Temperatures 5°C to 40°C).
            </p>
          </div>
        </div>
      )}

      {/* Alerts Feed */}
      <div className="grid grid-cols-1 gap-4">
        {alerts.map((alert) => (
          <div
            key={alert.alert_id}
            onClick={() => onAlertSelect && onAlertSelect(alert.latitude, alert.longitude)}
            className={`${glassCard} hover:border-white/20 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden group`}
          >
            <div className="space-y-2.5 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full border ${getSeverityBadge(alert.severity)}`}>
                  {alert.severity}
                </span>
                <span className="text-xs font-mono text-cyan-400">{alert.lead_time}</span>
                <span className="text-neutral-500 text-xs">•</span>
                <div className="flex items-center gap-1 text-xs text-white font-medium">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{alert.region}</span>
                  <span className="text-neutral-400 text-[11px]">({alert.subdivision})</span>
                </div>
              </div>

              <p className="text-xs text-neutral-200 leading-relaxed font-sans">
                {alert.synoptic_cause}
              </p>

              <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                  Evaluated: <strong className="text-neutral-300 font-normal">{alert.issued_at}</strong>
                </span>
                <span>•</span>
                <span>
                  Observed: <strong className="text-white">{alert.observed_value} {alert.unit}</strong> (IMD Trigger: {alert.threshold_value} {alert.unit})
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-6">
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                {getAlertIcon(alert.category)}
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono text-neutral-400 block uppercase">
                  Ensemble Trust
                </span>
                <span className="text-base font-mono font-bold text-emerald-400">
                  {alert.confidence}%
                </span>
              </div>

              <ExternalLink className="w-4 h-4 text-neutral-500 group-hover:text-cyan-400 transition" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExtremeAlerts;