import React from 'react';
import { TrendingUp, BarChart3, Award, CheckCircle2 } from 'lucide-react';

interface MetricChartsProps {
  variable: string;
}

export const MetricCharts: React.FC<MetricChartsProps> = ({ variable }) => {
  const leadTimes = ['T+6h', 'T+12h', 'T+24h', 'T+48h', 'T+72h', 'T+120h'];
  
  // Comparative RMSE error benchmarks (Lower is better)
  const rmseData = [
    { model: 'NCUM-Global', scores: [1.42, 1.68, 2.15, 2.85, 3.42, 4.10], color: 'bg-cyan-500' },
    { model: 'NEPS-Regional', scores: [1.35, 1.55, 1.98, 2.70, 3.25, 3.95], color: 'bg-indigo-400' },
    { model: 'ECMWF IFS', scores: [1.38, 1.60, 2.05, 2.75, 3.30, 4.02], color: 'bg-amber-400' },
    { model: 'ATMOS AI Blended', scores: [1.12, 1.28, 1.62, 2.18, 2.74, 3.35], color: 'bg-emerald-400', highlight: true },
  ];

  const glassCard = "rounded-3xl bg-slate-900/15 backdrop-blur-md border border-white/10 p-6 shadow-2xl";

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`${glassCard} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              Forecast Skill Verification vs. ERA5 & IMD AWS
            </h2>
          </div>
          <p className="text-xs text-neutral-300 mt-1">
            Quantitative validation demonstrating error reduction achieved by the hybrid blending framework.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
          <Award className="w-4 h-4" />
          <span>Skill Score Improvement: +18.4%</span>
        </div>
      </div>

      {/* Comparative Evaluation Table & Lead Horizon Curves */}
      <div className={`${glassCard} space-y-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-300">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>Root Mean Square Error (RMSE) by Lead Horizon (mm / °C)</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">Validation: 1,200 Grid Coordinates</span>
        </div>

        {/* Lead time bars */}
        <div className="space-y-4">
          {rmseData.map((item) => (
            <div key={item.model} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className={`font-mono font-medium ${item.highlight ? 'text-emerald-400 font-bold flex items-center gap-1.5' : 'text-neutral-300'}`}>
                  {item.highlight && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {item.model}
                </span>
                <span className="font-mono text-neutral-400 text-[11px]">
                  Avg RMSE: {(item.scores.reduce((a, b) => a + b, 0) / item.scores.length).toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {item.scores.map((score, idx) => (
                  <div key={idx} className="relative bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] flex flex-col justify-between">
                    <span className="text-[9px] font-mono text-neutral-400 block">{leadTimes[idx]}</span>
                    <div className="flex items-end gap-1.5 mt-2">
                      <div
                        className={`w-1.5 rounded-full ${item.color}`}
                        style={{ height: `${Math.min(Math.max(score * 8, 8), 36)}px` }}
                      />
                      <span className={`font-mono text-xs font-semibold ${item.highlight ? 'text-white' : 'text-neutral-300'}`}>
                        {score.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MetricCharts;