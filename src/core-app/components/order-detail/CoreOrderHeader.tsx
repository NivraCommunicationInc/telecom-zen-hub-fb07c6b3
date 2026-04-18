/**
 * CoreOrderHeader — Dark header for the order processing console.
 *
 * Visual: matches HTML reference
 *   - Background #0f1623, white id (15px), muted subline (11px)
 *   - Right side: status pills (orange/yellow/gray/blue) + SLA red pulse pill when overdue
 *   - Refresh + Impersonate buttons
 *
 * IMPORTANT: We DO NOT change the existing public prop API consumed by other code paths.
 * The component now accepts both the legacy props (order/profile/account/appointment/incompleteAlert/onRefresh)
 * AND new pre-computed display strings used by CoreOrderDetail. All extras are optional.
 */
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { differenceInMinutes } from "date-fns";
import { RefreshCw, Copy, Timer, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ImpersonateButton } from "@/core-app/components/ImpersonateButton";

interface Props {
  order: any;
  profile: any;
  account: any;
  appointment?: any;
  incompleteAlert?: { id: string; details: any } | null;
  onRefresh: () => void;
  // Pre-computed display values (optional, used by CoreOrderDetail rebuild)
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  productSummary?: string;
  orderNumber?: string;
  totalAmount?: string;
}

/** Tone-based pill — maps a free-form status string to a color theme. */
function StatusPill({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  let cls = "bg-[#2a2f3a] text-[#9ba7b8]"; // gray default
  if (["submitted", "processing", "pending_payment", "in_progress"].includes(v))
    cls = "bg-[#7c3a00] text-[#ffb74d]";
  else if (["pending", "awaiting", "pending_review", "on_hold"].includes(v))
    cls = "bg-[#5a4200] text-[#ffd54f]";
  else if (["activated", "completed", "paid", "delivered", "approved", "captured", "confirmed"].includes(v))
    cls = "bg-[#1b4a1b] text-[#81c784]";
  else if (["cancelled", "rejected", "fraud", "failed", "invalid_payment"].includes(v))
    cls = "bg-[#7f0000] text-[#ef9a9a]";
  else if (["auto", "automatic", "scheduled"].includes(v))
    cls = "bg-[#0d2d54] text-[#64b5f6]";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-[3px] rounded-full ${cls}`}>
      {value}
    </span>
  );
}

function computeSla(
  deadline: string | null | undefined,
  status: string | null | undefined,
  orderStatus: string,
): { label: string; overdue: boolean } | null {
  if (["activated", "completed", "cancelled", "installation_completed", "delivered"].includes(orderStatus)) {
    return null;
  }
  if (!deadline) return null;
  const minsLeft = differenceInMinutes(new Date(deadline), new Date());
  if (status === "overdue" || minsLeft < 0) {
    const overdue = Math.abs(minsLeft);
    const label = overdue >= 60 ? `SLA DÉPASSÉ ${Math.floor(overdue / 60)}h` : `SLA DÉPASSÉ ${overdue}min`;
    return { label, overdue: true };
  }
  if (minsLeft < 60 || status === "warning") {
    return { label: `SLA ${minsLeft}min`, overdue: false };
  }
  return { label: `SLA ${Math.floor(minsLeft / 60)}h`, overdue: false };
}

export function CoreOrderHeader({
  order, profile, account, incompleteAlert, onRefresh,
  clientName, clientEmail, clientPhone, productSummary, orderNumber, totalAmount,
}: Props) {
  // Fallback computed values if caller didn't provide them
  const _clientName = clientName ??
    (profile?.full_name ||
      [order.client_first_name, order.client_last_name].filter(Boolean).join(" ") ||
      "—");
  const _clientEmail = clientEmail ?? (order.client_email || profile?.email || "");
  const _clientPhone = clientPhone ?? (order.client_phone || profile?.phone || "");
  const _orderNumber = orderNumber ?? (order.order_number || `#${order.id?.slice(0, 8)}`);
  const _totalAmount = totalAmount ?? (order.total_amount != null
    ? Number(order.total_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
    : "—");
  const _productSummary = productSummary ?? (order.service_type || "—");

  const sla = computeSla(order.sla_deadline, order.sla_status, order.status);
  const channelTag = order.channel || (order.created_by_role === "system" ? "auto" : null);

  const copyId = () => {
    navigator.clipboard.writeText(order.order_number || order.id);
    toast.success("Copié");
  };

  return (
    <div className="bg-[#0f1623] text-[#e8eaf0] px-4 py-3 flex items-center gap-3 flex-wrap border-b border-[#1e2535]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-[15px] font-medium text-white truncate font-mono">
            {_orderNumber}
          </h1>
          <button onClick={copyId} className="text-[#5a6578] hover:text-white" title="Copier l'identifiant">
            <Copy className="h-3 w-3" />
          </button>
          <span className="text-[15px] font-medium text-white truncate">— {_clientName}</span>
        </div>
        <p className="text-[11px] text-[#8b9ab0] mt-0.5 truncate">
          {_productSummary}
          {_clientEmail ? <> · {_clientEmail}</> : null}
          {_clientPhone ? <> · {_clientPhone}</> : null}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusPill value={order.status} />
        {order.payment_status && <StatusPill value={order.payment_status} />}
        {order.kyc_status && order.kyc_status !== "not_required" && (
          <StatusPill value={`KYC: ${order.kyc_status}`} />
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-[3px] rounded-full bg-[#2a2f3a] text-[#c0c9d8] tabular-nums">
          {_totalAmount}
        </span>
        {channelTag && <StatusPill value={channelTag} />}
        {incompleteAlert && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-[3px] rounded-full bg-[#5a4200] text-[#ffd54f]">
            <AlertTriangle className="h-3 w-3" /> Incomplet
          </span>
        )}
        {order.risk_flags && order.risk_flags.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-[3px] rounded-full bg-[#7f0000] text-[#ef9a9a]">
            <AlertTriangle className="h-3 w-3" /> RISQUE
          </span>
        )}
        {sla && (
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              sla.overdue ? "bg-[#b71c1c] text-white animate-pulse" : "bg-[#5a4200] text-[#ffd54f]"
            }`}
          >
            <Timer className="h-3 w-3" />
            {sla.label}
          </span>
        )}

        {(profile?.user_id || order.user_id) && (
          <ImpersonateButton
            variant="compact"
            clientId={profile?.user_id || order.user_id}
            clientEmail={_clientEmail}
            clientName={_clientName}
          />
        )}

        {account && (
          <Link
            to={corePath(`/accounts/${account.id}`)}
            className="inline-flex items-center gap-1 text-[11px] text-[#64b5f6] hover:text-[#90caf9] border border-[#0d2d54] bg-[#0d2d54]/30 rounded-full px-2.5 py-[3px]"
            title="Compte 360"
          >
            #{account.account_number}
          </Link>
        )}

        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1 rounded-full border border-[#1e2535] bg-[#131929] px-2.5 py-1 text-[11px] text-[#8b9ab0] hover:text-white hover:border-[#3b82f6]/40 transition-colors"
          title="Actualiser"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
