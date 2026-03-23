/**
 * InfoGrid — Reusable dense information display components for employee portal.
 */
import { cn } from "@/lib/utils";
import { LucideIcon, Lock } from "lucide-react";

export function InfoRow({ label, value, bold, mono }: { label: string; value: string | React.ReactNode; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-3 text-xs py-0.5">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-foreground text-right", bold && "font-semibold", mono && "font-mono text-[11px]")}>{value}</span>
    </div>
  );
}

export function Section({ title, icon, children, locked, className }: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  locked?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-3", className)}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{title}</h3>
        {locked && (
          <span className="ml-auto inline-flex items-center gap-1 text-[8px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded font-mono">
            <Lock className="h-2.5 w-2.5" />
            LECTURE SEULE
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function MiniKPI({ label, value, color, icon: Icon }: {
  label: string;
  value: string | number;
  color?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={cn("h-3 w-3", color ?? "text-muted-foreground")} />}
        <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("text-sm font-bold mt-0.5", color ?? "text-foreground")}>{value}</p>
    </div>
  );
}

export function TraceabilityStrip({ items }: { items: { label: string; value: string | null | undefined }[] }) {
  const validItems = items.filter(i => i.value);
  if (validItems.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-muted-foreground/70 font-mono">
      {validItems.map((item, i) => (
        <span key={item.label}>
          {i > 0 && "· "}
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  );
}

export const fmtMoney = (v: number | null | undefined) => v != null ? `${v.toFixed(2)} $` : "—";
