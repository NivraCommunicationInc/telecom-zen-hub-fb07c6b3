/**
 * Shared Marketing Hub UI primitives — Nivra dark theme.
 * Brand spec: bg #111118, card #0D0D1A, border #1E1E2E,
 * primary #7C3AED, success #10B981, warning #F59E0B, error #EF4444,
 * text white / secondary #888, radius 10px,
 * section labels uppercase 10px tracking-[2px] #888.
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export const MK_BG = "bg-[#111118]";
export const MK_CARD = "bg-[#0D0D1A] border border-[#1E1E2E]";
export const MK_TEXT = "text-white";
export const MK_MUTED = "text-[#888]";
export const MK_ACCENT = "#7C3AED";

/** Page wrapper — dark canvas, white text, generous spacing. */
export function MKPage({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-h-full -m-4 sm:-m-6 p-4 sm:p-6 space-y-6", MK_BG, MK_TEXT)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className={cn("text-sm mt-1", MK_MUTED)}>{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** Section card — rounded-[10px] dark surface. */
export function MKCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-[10px]", MK_CARD, className)}>{children}</div>
  );
}

export function MKCardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E1E2E]">
      <h3 className="text-[10px] font-semibold uppercase tracking-[2px] text-[#888]">{title}</h3>
      {action}
    </div>
  );
}

/** Compact KPI tile. */
export function MKStat({ label, value, icon: Icon, hint, accent = "#7C3AED" }: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className={cn("rounded-[10px] p-4", MK_CARD)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[2px] text-[#888]">{label}</span>
        {Icon && (
          <div
            className="h-7 w-7 rounded-md flex items-center justify-center"
            style={{ background: `${accent}1A` }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold tabular-nums mt-2 text-white">{value}</div>
      {hint && <div className="text-xs text-[#888] mt-1">{hint}</div>}
    </div>
  );
}
