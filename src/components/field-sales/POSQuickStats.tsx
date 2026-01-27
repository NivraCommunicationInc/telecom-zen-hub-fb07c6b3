/**
 * POSQuickStats - Compact real-time stats bar for POS
 */
import { TrendingUp, DollarSign, ShoppingCart, Clock, Target, Award, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface POSQuickStatsProps {
  todaySales: number;
  todayRevenue: number;
  pendingSales: number;
  weekCommissions: number;
  targetProgress?: number;
}

export function POSQuickStats({ 
  todaySales, 
  todayRevenue, 
  pendingSales, 
  weekCommissions,
  targetProgress = 0,
}: POSQuickStatsProps) {
  return (
    <div className="bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-slate-900/80 backdrop-blur-sm border-b border-slate-700/50">
      <div className="px-4 py-2.5">
        <div className="flex items-center justify-between gap-4 overflow-x-auto">
          {/* Today stats */}
          <div className="flex items-center gap-4 shrink-0">
            <StatPill
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              label="Aujourd'hui"
              value={todaySales}
              suffix="ventes"
              color="orange"
            />
            <StatPill
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="Revenus"
              value={`${todayRevenue.toFixed(0)}$`}
              color="emerald"
            />
            {pendingSales > 0 && (
              <StatPill
                icon={<Clock className="h-3.5 w-3.5" />}
                label="En attente"
                value={pendingSales}
                color="amber"
                pulse
              />
            )}
            <StatPill
              icon={<Award className="h-3.5 w-3.5" />}
              label="Commissions"
              value={`${weekCommissions.toFixed(0)}$`}
              color="purple"
            />
          </div>

          {/* Target progress */}
          <div className="hidden lg:flex items-center gap-3 shrink-0 pl-4 border-l border-slate-700/50">
            <Target className="h-4 w-4 text-cyan-400" />
            <div className="w-32">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">Objectif</span>
                <span className="text-[10px] font-bold text-cyan-400">{Math.round(targetProgress)}%</span>
              </div>
              <Progress 
                value={Math.min(100, targetProgress)} 
                className="h-1.5 bg-slate-700"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatPillProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
  color: "orange" | "emerald" | "amber" | "purple" | "cyan";
  pulse?: boolean;
}

const colorMap = {
  orange: {
    bg: "bg-orange-500/15",
    border: "border-orange-500/30",
    text: "text-orange-400",
    icon: "text-orange-400",
  },
  emerald: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    icon: "text-emerald-400",
  },
  amber: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    text: "text-amber-400",
    icon: "text-amber-400",
  },
  purple: {
    bg: "bg-purple-500/15",
    border: "border-purple-500/30",
    text: "text-purple-400",
    icon: "text-purple-400",
  },
  cyan: {
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    icon: "text-cyan-400",
  },
};

function StatPill({ icon, label, value, suffix, color, pulse }: StatPillProps) {
  const colors = colorMap[color];
  
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
      colors.bg,
      colors.border,
      pulse && "animate-pulse"
    )}>
      <div className={colors.icon}>{icon}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-sm font-bold", colors.text)}>{value}</span>
        {suffix && <span className="text-[10px] text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}
