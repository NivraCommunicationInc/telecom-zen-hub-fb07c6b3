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
  confirmed: "text-[#16A34A]",
  paid: "text-[#16A34A]",
  pending: "text-[#D97706]",
  failed: "text-[#DC2626]",
  cancelled: "text-[#6B7280]",
  // Sync
  synced: "text-[#16A34A]",
  error: "text-[#DC2626]",
  // Installation
  installed: "text-[#16A34A]",
  delivered: "text-[#2563EB]",
  shipped: "text-[#2563EB]",
  processing: "text-[#D97706]",
  // Service
  active: "text-[#16A34A]",
  activated: "text-[#16A34A]",
  suspended: "text-[#DC2626]",
  // Commission
  approved: "text-[#16A34A]",
  // Generic
  completed: "text-[#16A34A]",
};

function StatusCell({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  const color = STATUS_COLORS[value] || "text-[#6B7280]";
  return (
    <div className="p-2.5 rounded-lg bg-[#F9FAFB] border border-[#F3F4F6]">
      <p className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider">{label}</p>
      <p className={cn("text-xs font-bold mt-0.5 capitalize", color)}>
        {value || "—"}
        {suffix && <span className="text-[10px] font-normal text-[#6B7280] ml-1">{suffix}</span>}
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
