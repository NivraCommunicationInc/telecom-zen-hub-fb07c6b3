/** Shared Marketing Hub UI primitives — Mailchimp-inspired workbench. */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export const MK_BG = "bg-background";
export const MK_CARD = "bg-card border border-border shadow-sm";
export const MK_TEXT = "text-foreground";
export const MK_MUTED = "text-muted-foreground";
export const MK_ACCENT = "hsl(var(--primary))";

export function MKPage({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-h-full -m-4 sm:-m-6 p-4 sm:p-6 space-y-6", MK_BG, MK_TEXT)} data-marketing-workbench>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-black leading-tight tracking-normal md:text-4xl">{title}</h1>
          {subtitle && <p className={cn("text-sm mt-1 max-w-3xl", MK_MUTED)}>{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function MKCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl", MK_CARD, className)}>{children}</div>
  );
}

export function MKCardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
      <h3 className="text-xs font-black uppercase tracking-normal text-muted-foreground">{title}</h3>
      {action}
    </div>
  );
}

export function MKStat({ label, value, icon: Icon, hint, accent = "#7C3AED" }: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className={cn("rounded-xl p-4", MK_CARD)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-normal text-muted-foreground">{label}</span>
        {Icon && (
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center bg-secondary"
          >
            <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
          </div>
        )}
      </div>
      <div className="text-3xl font-black tabular-nums mt-2 text-foreground">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
