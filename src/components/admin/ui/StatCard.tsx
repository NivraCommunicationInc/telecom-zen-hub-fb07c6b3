/**
 * StatCard — Compact KPI card for admin dashboards
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
        "rounded-md border border-border bg-card px-3 py-2.5 transition-colors",
        href && "cursor-pointer hover:border-primary/30",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xl font-bold text-foreground tabular-nums leading-none">{value}</p>
          <span className="text-[11px] text-muted-foreground truncate">{label}</span>
        </div>
      </div>
      {change && (
        <p className={cn(
          "text-xs font-medium mt-1",
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
