import React, { useState } from 'react';
import { 
  Globe, 
  Cpu, 
  CheckCircle2, 
  ChevronRight, 
  Layers, 
  Activity, 
  Clock, 
  ExternalLink 
} from 'lucide-react';

export interface ModelInventoryItem {
  id: string;
  name: string;
  agency: string;
  type: string;
  typeBadge: string;
  resolution: string;
  leadHorizon: string;
  assimilation: string;
  strengths: string;
  blendingBehavior: string;
  ingestion: string;
}

const MODELS_DATA: ModelInventoryItem[] = [
  {
    id: 'ncum',
    name: 'NCUM-Global',
    agency: 'NCMRWF / MoES',
    type: 'Physics NWP',
    typeBadge: 'Physics NWP',
    resolution: '12 km Global Grid',
    leadHorizon: '10 Days (240 Hours)',
    assimilation: '0000 & 1200 UTC',
    strengths: 'Primary synoptic dynamical core; superior large-scale pressure & monsoon trough tracking.',
    blendingBehavior: 'Highest weight at T+12h to T+48h',
    ingestion: 'WMO Essential GTS / Open-Data',
  },
  {
    id: 'neps',
    name: 'NEPS-Regional',
    agency: 'NCMRWF / MoES',
    type: 'Ensemble System',
    typeBadge: 'Ensemble System',
    resolution: '4 km Convection-Permitting',
    leadHorizon: '5 Days (120 Hours)',
    assimilation: '00Z, 06Z, 12Z, 18Z',
    strengths: 'Sub-grid explicit cloud microphysics & localized convective squall line tracking over the Indian subcontinent.',
    blendingBehavior: 'Dynamic weight surge during high CAPE / thunderstorm alerts',
    ingestion: 'NCMRWF Local Open-DAP / AWS Grid',
  },
  {
    id: 'imd-mme',
    name: 'IMD Multi-Model Ensemble',
    agency: 'India Meteorological Department',
    type: 'National MME',
    typeBadge: 'National MME',
    resolution: '0.25° Spatial Grid',
    leadHorizon: '7 Days (168 Hours)',
    assimilation: 'Operational Synoptic Cycle',
    strengths: 'Official national weather forecasting baseline; calibrated heavily for Indian monsoon rainfall distribution.',
    blendingBehavior: 'Baseline reference for precipitation bias correction',
    ingestion: 'IMD National Data Centre Open-Portal',
  },
  {
    id: 'ecmwf',
    name: 'ECMWF IFS (HRES)',
    agency: 'ECMWF',
    type: 'Physics NWP',
    typeBadge: 'Physics NWP',
    resolution: '9 km Global Grid',
    leadHorizon: '10 Days (240 Hours)',
    assimilation: '00Z, 06Z, 12Z, 18Z',
    strengths: 'World-leading upper-air dynamics, global mass field accuracy, and extended-range predictability.',
    blendingBehavior: 'Secondary physics control to damp global boundary divergence',
    ingestion: 'ECMWF Open Data / MARS API',
  },
  {
    id: 'dwd-icon',
    name: 'DWD ICON',
    agency: 'Deutscher Wetterdienst (DWD)',
    type: 'Physics NWP',
    typeBadge: 'Physics NWP',
    resolution: '13 km Global Grid',
    leadHorizon: '7 Days (168 Hours)',
    assimilation: '00Z, 06Z, 12Z, 18Z',
    strengths: 'Non-hydrostatic global core with triangular grid architecture providing exceptional mass conservation over variable topography.',
    blendingBehavior: 'High weight allocation in orographic foothill corridors (e.g. Shivalik / Roorkee)',
    ingestion: 'DWD Open Data Server / Open-Meteo Gateway',
  },
  {
    id: 'noaa-gfs',
    name: 'NOAA GFS (NCEP)',
    agency: 'National Centers for Environmental Prediction',
    type: 'Physics NWP',
    typeBadge: 'Physics NWP',
    resolution: '13 km Global Grid',
    leadHorizon: '16 Days (384 Hours)',
    assimilation: '00Z, 06Z, 12Z, 18Z',
    strengths: 'FV3 dynamical core providing robust long-range synoptic circulation forecasts and boundary-layer thermodynamics.',
    blendingBehavior: 'Dominant baseline for continental arid thermal low verification (e.g. Thar Desert / Jaisalmer)',
    ingestion: 'NOAA NOMADS / Open-Meteo Gateway',
  },
  {
    id: 'meteofrance-arpege',
    name: 'Météo-France ARPEGE',
    agency: 'Météo-France',
    type: 'Physics NWP',
    typeBadge: 'Physics NWP',
    resolution: '0.25° Variable Resolution Grid',
    leadHorizon: '4 Days (96 Hours)',
    assimilation: '00Z & 12Z UTC',
    strengths: 'Stretched grid stretching technique providing high-density resolution over targeted European and Mediterranean synoptic corridors.',
    blendingBehavior: 'Supplemental cross-model ensemble verification',
    ingestion: 'Météo-France Open-Data / Open-Meteo Gateway',
  },
  {
    id: 'open-meteo',
    name: 'Open-Meteo Ensembles',
    agency: 'Open-Meteo API Gateway',
    type: 'Hybrid API Hub',
    typeBadge: 'Ensemble Hub',
    resolution: 'Multi-Model Weighted Grid',
    leadHorizon: '7 Days (168 Hours)',
    assimilation: 'Real-Time API Polling',
    strengths: 'Unified multi-model ingestion hub aggregating high-frequency meteorological data packets with automated timezone and elevation adjustment.',
    blendingBehavior: 'Primary telemetry ingest pipeline for real-time station variables',
    ingestion: 'RESTful JSON / Open-Meteo API',
  },
  {
    id: 'neural-atmos',
    name: 'Neural-Atmos Emulator',
    agency: 'ATMOS AI Lab (Hybrid Core)',
    type: 'AI/ML Emulator',
    typeBadge: 'AI/ML Emulator',
    resolution: '0.25° Spherical Mesh',
    leadHorizon: 'Instantaneous Nowcast (T+0 to T+6h)',
    assimilation: 'Real-Time Radar & AWS Feed',
    strengths: 'Data-driven deep learning surrogate model optimized for lightning-fast spatial interpolation and extreme precipitation nowcasting.',
    blendingBehavior: 'Dominates immediate nowcasting window (T+0 to T+3h)',
    ingestion: 'Real-Time Edge Telemetry Stream',
  },
];

export const ModelsPanel: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState<ModelInventoryItem>(MODELS_DATA[0]);

  const cardStyle = 'rounded-2xl bg-slate-950/35 backdrop-blur-2xl border border-white/[0.09] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] transition-all';
  const tileStyle = 'rounded-xl bg-white/[0.025] border border-white/[0.05] p-3.5 transition-all cursor-pointer hover:border-cyan-400/40';

  return (
    <div className="w-full space-y-4 font-sans text-slate-100">
      
      {/* Top Banner Header */}
      <div className={`${cardStyle} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white tracking-wide">
                Ensemble System & Model Inventories
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                PS 26081 ARCHITECTURE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cross-model comparison matrix driving the adaptive hybrid AI-NWP blending framework.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs text-slate-300">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white">{MODELS_DATA.length} Models Integrated</span>
        </div>
      </div>

      {/* Main Grid: Left Model Selector List, Right Inspection Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column: Model List Selection Cards */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
          {MODELS_DATA.map((model) => {
            const isSelected = selectedModel.id === model.id;
            return (
              <div
                key={model.id}
                onClick={() => setSelectedModel(model)}
                className={`${tileStyle} ${
                  isSelected
                    ? 'bg-cyan-500/[0.08] border-cyan-400/50 shadow-[0_4px_20px_rgba(6,182,212,0.15)]'
                    : 'hover:bg-white/[0.04]'
                } flex items-center justify-between`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{model.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300 border border-white/10">
                      {model.typeBadge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">{model.agency}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium text-cyan-300">{model.resolution}</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600'}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Detailed Active Model Inspection Cockpit */}
        <div className={`lg:col-span-7 ${cardStyle} flex flex-col justify-between space-y-6`}>
          
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block mb-1">
                  Active Model Inspection
                </span>
                <h3 className="text-xl font-bold font-mono text-white tracking-tight">
                  {selectedModel.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedModel.agency}</p>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>OPERATIONAL</span>
              </div>
            </div>

            {/* Parameter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase mb-1">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  Resolution
                </div>
                <div className="text-sm font-mono font-bold text-white">{selectedModel.resolution}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase mb-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Lead Horizon
                </div>
                <div className="text-sm font-mono font-bold text-white">{selectedModel.leadHorizon}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase mb-1">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  Assimilation Cycle
                </div>
                <div className="text-xs font-mono font-bold text-white">{selectedModel.assimilation}</div>
              </div>
            </div>

            {/* Synoptic Strengths */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Synoptic Physical Strengths
              </span>
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-300 leading-relaxed font-sans">
                {selectedModel.strengths}
              </div>
            </div>

            {/* Adaptive Blending Behavior */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">
                Adaptive Blending Behavior (PS 26081)
              </span>
              <div className="p-3.5 rounded-xl bg-cyan-500/[0.06] border border-cyan-500/20 text-xs text-cyan-200 font-sans font-medium">
                {selectedModel.blendingBehavior}
              </div>
            </div>
          </div>

          {/* Bottom Protocol Footer */}
          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Automated Ingestion Protocol: {selectedModel.ingestion}</span>
            <ExternalLink className="w-4 h-4 text-slate-500 hover:text-cyan-400 cursor-pointer transition" />
          </div>

        </div>

      </div>

    </div>
  );
};

export default ModelsPanel;