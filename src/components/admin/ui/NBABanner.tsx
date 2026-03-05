/**
 * NBABanner — Next Best Action banner for Order Workbench
 * Highlights the most critical blocker at the top
 */
import { LucideIcon, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NBAItem {
  icon: LucideIcon;
  label: string;
  priority: "high" | "medium" | "low";
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

interface NBABannerProps {
  items: NBAItem[];
  allClear?: boolean;
}

export function NBABanner({ items, allClear }: NBABannerProps) {
  if (allClear || items.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          Aucune action requise — commande en bonne voie
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const Icon = item.icon;
        const isHigh = item.priority === "high";
        return (
          <div
            key={i}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-4 py-3",
              isHigh
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className={cn("h-4 w-4 shrink-0", isHigh ? "text-amber-500" : "text-muted-foreground")} />
              <span className="text-sm font-medium text-foreground truncate">{item.label}</span>
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5",
                isHigh ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"
              )}>
                {item.priority === "high" ? "Urgent" : item.priority === "medium" ? "Normal" : "Info"}
              </span>
            </div>
            {item.actionLabel && (
              <Button
                size="sm"
                variant={isHigh ? "default" : "outline"}
                onClick={item.onAction}
                disabled={item.disabled}
                className="shrink-0 text-xs h-7"
                title={item.disabledReason}
              >
                {item.actionLabel}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
