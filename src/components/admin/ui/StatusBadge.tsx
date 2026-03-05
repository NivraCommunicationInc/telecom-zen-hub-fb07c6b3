/**
 * Unified StatusBadge — TELUS-grade status indicator
 * Min 12px text, proper contrast, dot indicators
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
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  danger: "bg-red-500/15 text-red-400 border-red-500/25",
  info: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  neutral: "bg-muted text-muted-foreground border-border",
  purple: "bg-violet-500/15 text-violet-400 border-violet-500/25",
};

const DOT_STYLES: Record<StatusVariant, string> = {
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-red-400",
  info: "bg-sky-400",
  neutral: "bg-muted-foreground",
  purple: "bg-violet-400",
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
        "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-[13px]",
        VARIANT_STYLES[variant],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT_STYLES[variant])} />}
      {label}
    </span>
  );
}
