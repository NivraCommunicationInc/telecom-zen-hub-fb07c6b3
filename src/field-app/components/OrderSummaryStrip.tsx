/**
 * OrderSummaryStrip — Compact 6-field status block for field order detail.
 * No scrolling needed to understand the deal.
 */
import { cn } from "@/lib/utils";

interface Props {
  saleStatus: string;
  paymentStatus: string;
  syncStatus: string;
  installationStatus: string;
  serviceStatus: string;
  commissionStatus: string;
  commissionAmount?: number;
}

const STATUS_COLORS: Record<string, string> = {
  // Payment
  confirmed: "text-[hsl(var(--field-success))]",
  paid: "text-[hsl(var(--field-success))]",
  pending: "text-[hsl(var(--field-warning))]",
  failed: "text-[hsl(var(--field-danger))]",
  cancelled: "text-[hsl(var(--field-text-muted))]",
  // Sync
  synced: "text-[hsl(var(--field-success))]",
  error: "text-[hsl(var(--field-danger))]",
  // Installation
  installed: "text-[hsl(var(--field-success))]",
  delivered: "text-[hsl(var(--field-accent-glow))]",
  shipped: "text-[hsl(var(--field-accent-glow))]",
  processing: "text-[hsl(var(--field-warning))]",
  // Service
  active: "text-[hsl(var(--field-success))]",
  activated: "text-[hsl(var(--field-success))]",
  suspended: "text-[hsl(var(--field-danger))]",
  // Commission
  approved: "text-[hsl(var(--field-success))]",
  // Generic
  completed: "text-[hsl(var(--field-success))]",
};

function StatusCell({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  const color = STATUS_COLORS[value] || "text-[hsl(var(--field-text-muted))]";
  return (
    <div className="p-2.5 rounded-lg bg-[hsl(var(--field-card))] border border-[hsl(var(--field-border-subtle))]">
      <p className="text-[10px] text-[hsl(var(--field-text-dim))] font-medium uppercase tracking-wider">{label}</p>
      <p className={cn("text-xs font-bold mt-0.5 capitalize", color)}>
        {value || "—"}
        {suffix && <span className="text-[10px] font-normal text-[hsl(var(--field-text-muted))] ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

export function OrderSummaryStrip(props: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      <StatusCell label="Vente" value={props.saleStatus} />
      <StatusCell label="Paiement" value={props.paymentStatus} />
      <StatusCell label="Sync Core" value={props.syncStatus} />
      <StatusCell label="Installation" value={props.installationStatus} />
      <StatusCell label="Service" value={props.serviceStatus} />
      <StatusCell
        label="Commission"
        value={props.commissionStatus}
        suffix={props.commissionAmount != null ? `${props.commissionAmount.toFixed(2)} $` : undefined}
      />
    </div>
  );
}
