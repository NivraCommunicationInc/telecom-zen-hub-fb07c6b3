/**
 * StatCard — KPI card for admin dashboards
 * Proper sizing: 14px label, 28px value, semantic tokens
 */
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  href?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, change, changeType = "neutral", href, className }: StatCardProps) {
  const Wrapper = href ? "a" : "div";
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "rounded-xl border border-border bg-card p-5 space-y-3 transition-colors",
        href && "cursor-pointer hover:border-primary/30",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>
      <p className="text-[28px] font-bold text-foreground tabular-nums leading-none">{value}</p>
      {change && (
        <p className={cn(
          "text-sm font-medium",
          changeType === "positive" && "text-emerald-400",
          changeType === "negative" && "text-red-400",
          changeType === "neutral" && "text-muted-foreground"
        )}>
          {change}
        </p>
      )}
    </Wrapper>
  );
}
