/**
 * FieldSalesStatsCards - Professional stats dashboard for field sales admin
 */
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  CheckCircle,
  Target,
  Package,
  Cloud,
  DollarSign,
  TrendingUp,
  Award,
} from "lucide-react";

interface SalesStats {
  totalReps: number;
  activeReps: number;
  totalSalesToday: number;
  totalSalesWeek: number;
  totalSalesMonth: number;
  pendingSyncs: number;
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  totalRevenue: number;
}

interface FieldSalesStatsCardsProps {
  stats: SalesStats;
}

export function FieldSalesStatsCards({ stats }: FieldSalesStatsCardsProps) {
  const statCards = [
    {
      label: "Représentants",
      value: stats.totalReps,
      subValue: `${stats.activeReps} actifs`,
      icon: Users,
      gradient: "from-orange-500 to-amber-500",
      iconColor: "text-orange-400",
    },
    {
      label: "Ventes aujourd'hui",
      value: stats.totalSalesToday,
      subValue: "Nouvelles ventes",
      icon: Target,
      gradient: "from-cyan-500 to-teal-500",
      iconColor: "text-cyan-400",
    },
    {
      label: "Cette semaine",
      value: stats.totalSalesWeek,
      subValue: `${stats.totalSalesMonth} ce mois`,
      icon: TrendingUp,
      gradient: "from-purple-500 to-indigo-500",
      iconColor: "text-purple-400",
    },
    {
      label: "En attente sync",
      value: stats.pendingSyncs,
      subValue: "Ventes hors ligne",
      icon: Cloud,
      gradient: "from-amber-500 to-yellow-500",
      iconColor: "text-amber-400",
      alert: stats.pendingSyncs > 0,
    },
    {
      label: "Commissions",
      value: `$${stats.totalCommissions.toFixed(0)}`,
      subValue: `$${stats.pendingCommissions.toFixed(0)} à payer`,
      icon: DollarSign,
      gradient: "from-emerald-500 to-green-500",
      iconColor: "text-emerald-400",
    },
    {
      label: "Revenu total",
      value: `$${stats.totalRevenue.toFixed(0)}`,
      subValue: "Ventes terrain",
      icon: Award,
      gradient: "from-rose-500 to-pink-500",
      iconColor: "text-rose-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statCards.map((stat, index) => (
        <Card
          key={index}
          className={`border-slate-700/50 bg-slate-800/50 backdrop-blur-xl transition-all hover:border-slate-600 ${
            stat.alert ? "ring-2 ring-amber-500/30" : ""
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
              <p className={`text-xs mt-1 ${stat.iconColor}`}>{stat.subValue}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
