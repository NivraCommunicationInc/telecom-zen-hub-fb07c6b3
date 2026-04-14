/**
 * FieldUI — Shared semantic UI primitives for the Field Portal.
 * Provides consistent visual language across all field pages.
 */
import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Tone system ─── */
type Tone = "default" | "success" | "warning" | "danger" | "info" | "premium";

const toneBg: Record<Tone, string> = {
  default: "bg-secondary text-foreground",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  danger: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  premium: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
};

const toneBorder: Record<Tone, string> = {
  default: "border-border",
  success: "border-emerald-200 dark:border-emerald-800",
  warning: "border-amber-200 dark:border-amber-800",
  danger: "border-red-200 dark:border-red-800",
  info: "border-sky-200 dark:border-sky-800",
  premium: "border-violet-200 dark:border-violet-800",
};

/* ─── FieldBadge ─── */
export function FieldBadge({
  tone = "default",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        toneBg[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ─── FieldPanel ─── */
export function FieldPanel({
  title,
  description,
  children,
  tone,
  className,
  actions,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  tone?: Tone;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm",
        tone ? toneBorder[tone] : "border-border",
        className,
      )}
    >
      {(title || description || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-base font-semibold text-foreground">{title}</h3>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

/* ─── FieldMetricCard ─── */
export function FieldMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl", toneBg[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── FieldPageHeader ─── */
export function FieldPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

/* ─── FieldEmptyState ─── */
export function FieldEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      {Icon && (
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
