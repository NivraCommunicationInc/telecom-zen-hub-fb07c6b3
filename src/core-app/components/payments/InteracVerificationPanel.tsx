/**
 * Interac / manual verification workspace — pending transfer queue
 */
import type { AdminPayment } from "@/core-app/hooks/useAdminPayments";
import { StatusBadge } from "@/core-app/components/ui/StatusBadge";
import { fmtCAD } from "./PaymentConstants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, ShieldCheck,
  FileText, MessageSquare,
} from "lucide-react";

interface Props {
  payments: AdminPayment[];
  onSelect: (p: AdminPayment) => void;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM HH:mm", { locale: fr }); } catch { return "—"; }
};

export function InteracVerificationPanel({ payments, onSelect }: Props) {
  const pendingInterac = payments.filter(
    p => (p.method === "interac" || p.method === "manual") && (p.status === "pending" || p.status === "in_verification")
  );

  if (pendingInterac.length === 0) {
    return (
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-6 text-center">
        <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-emerald-400 opacity-50" />
        <p className="text-xs text-[#94A3B8]">Aucun transfert en attente de vérification</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(220,15%,16%)]">
        <ShieldCheck className="h-4 w-4 text-violet-400" />
        <h3 className="text-xs font-semibold text-[#F8FAFC]">File de vérification Interac / Manuel</h3>
        <span className="ml-auto text-[10px] font-semibold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
          {pendingInterac.length} en attente
        </span>
      </div>

      <div className="divide-y divide-[hsl(220,15%,14%)]">
        {pendingInterac.map(p => (
          <div
            key={p.id}
            onClick={() => onSelect(p)}
            className="flex items-center gap-4 px-4 py-3 hover:bg-[hsl(220,20%,13%)] cursor-pointer transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] font-medium text-[#F8FAFC]">{p.payment_number}</span>
                <StatusBadge
                  label={p.status === "in_verification" ? "En vérification" : "En attente"}
                  variant={p.status === "in_verification" ? "purple" : "warning"}
                  size="sm"
                />
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[11px] text-[#CBD5E1]">{p.customer_name || "—"}</span>
                <span className="text-[11px] text-[#64748B]">•</span>
                <span className="text-[11px] font-mono text-[#94A3B8]">{p.reference || "Aucune réf."}</span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm font-bold tabular-nums text-emerald-400">{fmtCAD(p.amount)}</p>
              <p className="text-[10px] text-[#64748B]">{fmtDate(p.created_at)}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={e => { e.stopPropagation(); }}
                className="h-7 w-7 flex items-center justify-center rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                title="Confirmer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); }}
                className="h-7 w-7 flex items-center justify-center rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                title="Refuser"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); }}
                className="h-7 w-7 flex items-center justify-center rounded-md border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors"
                title="Fraude"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
