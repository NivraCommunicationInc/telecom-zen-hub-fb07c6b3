/**
 * Unified StatusBadge — TELUS-grade status indicator
 * Single source of truth for all status rendering across admin
 */
import { cn } from "@/lib/utils";

export type StatusVariant =
  | "success" | "warning" | "danger" | "info" | "neutral" | "purple";

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

const VARIANT_STYLES: Record<StatusVariant, string> = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  neutral: "bg-muted text-muted-foreground border-border",
  purple: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
};

const DOT_STYLES: Record<StatusVariant, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  neutral: "bg-muted-foreground",
  purple: "bg-violet-500",
};

/** Map common telecom statuses to variants */
export function statusToVariant(status: string): StatusVariant {
  const s = status?.toLowerCase() || "";
  if (["active", "completed", "paid", "confirmed", "approved", "delivered", "signed"].some(k => s.includes(k))) return "success";
  if (["pending", "submitted", "in_transit", "label_created", "partial"].some(k => s.includes(k))) return "warning";
  if (["failed", "cancelled", "rejected", "blocked", "returned", "overdue"].some(k => s.includes(k))) return "danger";
  if (["in_progress", "in_review", "provisioning", "processing"].some(k => s.includes(k))) return "info";
  if (["kyc", "verification"].some(k => s.includes(k))) return "purple";
  return "neutral";
}

export function StatusBadge({ label, variant = "neutral", size = "sm", dot = true, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        VARIANT_STYLES[variant],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOT_STYLES[variant])} />}
      {label}
    </span>
  );
}
