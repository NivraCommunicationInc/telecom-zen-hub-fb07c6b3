/**
 * StatCard — KPI card for admin dashboards
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  className?: string;
}

export function StatCard({ label, value, icon: Icon, change, changeType = "neutral", className }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-4 space-y-2",
      className
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className="text-2xl font-semibold text-foreground tabular-nums">{value}</p>
      {change && (
        <p className={cn(
          "text-xs font-medium",
          changeType === "positive" && "text-emerald-500",
          changeType === "negative" && "text-red-500",
          changeType === "neutral" && "text-muted-foreground"
        )}>
          {change}
        </p>
      )}
    </div>
  );
}
