/**
 * SectionCard — Unified card wrapper for admin sections
 * Consistent padding, border, radius, header
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({ title, subtitle, icon: Icon, actions, children, className, noPadding }: SectionCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && <Icon className="h-5 w-5 text-primary shrink-0" />}
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-foreground truncate">{title}</h3>
              {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "p-5")}>
        {children}
      </div>
    </div>
  );
}
