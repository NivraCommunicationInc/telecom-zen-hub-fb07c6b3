/**
 * POSQuickStats - Real-time stats bar for POS dashboard
 */
import { TrendingUp, DollarSign, ShoppingCart, Clock, Target, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickStat {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  color: "orange" | "emerald" | "cyan" | "amber" | "purple";
}

interface POSQuickStatsProps {
  todaySales: number;
  todayRevenue: number;
  pendingSales: number;
  weekCommissions: number;
  targetProgress?: number;
}

const colorClasses = {
  orange: "from-orange-500/20 to-orange-500/5 border-orange-500/30 text-orange-400",
  emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400",
  cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400",
  amber: "from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400",
  purple: "from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400",
};

export function POSQuickStats({ 
  todaySales, 
  todayRevenue, 
  pendingSales, 
  weekCommissions,
  targetProgress = 0,
}: POSQuickStatsProps) {
  const stats: QuickStat[] = [
    {
      label: "Ventes",
      value: todaySales,
      sublabel: "Aujourd'hui",
      icon: <ShoppingCart className="h-4 w-4" />,
      color: "orange",
    },
    {
      label: "Revenus",
      value: `${todayRevenue.toFixed(0)}$`,
      sublabel: "Aujourd'hui",
      icon: <DollarSign className="h-4 w-4" />,
      color: "emerald",
    },
    {
      label: "En attente",
      value: pendingSales,
      sublabel: "À traiter",
      icon: <Clock className="h-4 w-4" />,
      color: pendingSales > 0 ? "amber" : "cyan",
    },
    {
      label: "Commissions",
      value: `${weekCommissions.toFixed(0)}$`,
      sublabel: "Cette semaine",
      icon: <Award className="h-4 w-4" />,
      color: "purple",
    },
  ];

  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-4 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "relative rounded-xl border bg-gradient-to-br p-2.5 backdrop-blur-sm",
              colorClasses[stat.color]
            )}
          >
            <div className="flex items-start justify-between mb-1">
              <span className="opacity-60">{stat.icon}</span>
            </div>
            <p className="text-lg font-bold text-white leading-none">
              {stat.value}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5">{stat.sublabel}</p>
          </div>
        ))}
      </div>

      {/* Target progress bar */}
      {targetProgress > 0 && (
        <div className="mt-3 px-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Target className="h-3 w-3" />
              Objectif mensuel
            </span>
            <span className="text-orange-400 font-medium">{Math.round(targetProgress)}%</span>
          </div>
          <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, targetProgress)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
