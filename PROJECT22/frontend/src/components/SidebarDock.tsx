import React from "react";
import { 
  LayoutGrid, 
  BarChart3, 
  Globe2, 
  CalendarRange, 
  Settings, 
  LogOut,
  ChevronLeft
} from "lucide-react";

export type TabType = "dashboard" | "metrics" | "globe" | "forecast" | "settings";

interface SidebarDockProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onBack?: () => void;
}

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Live Weather & Bento Grid", icon: LayoutGrid },
  { id: "metrics", label: "NWP Model Weights & Skill", icon: BarChart3 },
  { id: "globe", label: "Geographic Ensemble Grids", icon: Globe2 },
  { id: "forecast", label: "Multi-Day Consensus Projections", icon: CalendarRange },
  { id: "settings", label: "System Calibration & Config", icon: Settings },
];

export const SidebarDock: React.FC<SidebarDockProps> = ({
  activeTab,
  onSelectTab,
  onBack,
}) => {
  return (
    <aside className="fixed left-4 top-4 bottom-4 w-16 bg-neutral-950/40 backdrop-blur-2xl border border-white/10 rounded-3xl flex flex-col items-center justify-between py-6 z-50 shadow-2xl">
      {/* Top Back / Action Button */}
      <button
        onClick={onBack}
        title="Back"
        className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-neutral-300 hover:text-white transition-all duration-200 active:scale-95 group relative"
      >
        <ChevronLeft className="w-5 h-5" />
        {/* Hover Tooltip */}
        <span className="absolute left-16 px-3 py-1.5 rounded-xl bg-neutral-900/90 backdrop-blur-md border border-white/10 text-xs font-medium text-white tracking-wide opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-xl whitespace-nowrap z-50">
          Back
        </span>
      </button>

      {/* Main Navigation Stack */}
      <nav className="flex flex-col items-center gap-5 my-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <div key={item.id} className="relative flex items-center group">
              {/* Active vertical pill indicator (from screenshot) */}
              {isActive && (
                <div className="absolute -left-3 w-1.5 h-6 bg-white rounded-r-full shadow-[0_0_12px_rgba(255,255,255,0.8)] transition-all duration-300" />
              )}

              <button
                onClick={() => onSelectTab(item.id)}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 relative ${
                  isActive
                    ? "bg-white/20 text-white border border-white/20 shadow-lg shadow-white/5"
                    : "text-neutral-400 hover:text-white hover:bg-white/10 border border-transparent"
                }`}
              >
                <Icon className="w-5 h-5 stroke-[1.8]" />
              </button>

              {/* Floating Tooltip telling you what it is */}
              <div className="absolute left-16 px-3 py-1.5 rounded-xl bg-neutral-900/95 backdrop-blur-md border border-white/15 text-xs font-medium text-neutral-100 tracking-wide opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 shadow-2xl whitespace-nowrap z-50 flex items-center gap-2">
                <span>{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom Exit / Reset Action */}
      <div className="relative group">
        <button
          onClick={() => onSelectTab("dashboard")}
          className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-rose-400 transition-all duration-200 active:scale-95"
        >
          <LogOut className="w-4 h-4" />
        </button>

        <span className="absolute left-16 px-3 py-1.5 rounded-xl bg-neutral-900/90 backdrop-blur-md border border-white/10 text-xs font-medium text-neutral-200 tracking-wide opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-xl whitespace-nowrap z-50">
          Reset View
        </span>
      </div>
    </aside>
  );
};