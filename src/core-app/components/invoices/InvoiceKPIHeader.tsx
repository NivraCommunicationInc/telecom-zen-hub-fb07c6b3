/**
 * Invoice KPI header — billing operations dashboard strip
 */
import type { AdminInvoice } from "@/core-app/hooks/useAdminInvoices";
import { fmtCAD } from "./InvoiceConstants";
import {
  FileText, Clock, CheckCircle2, AlertTriangle, XCircle,
  RefreshCcw, DollarSign, TrendingUp,
} from "lucide-react";

interface Props {
  invoices: AdminInvoice[];
  isLoading: boolean;
}

export function InvoiceKPIHeader({ invoices, isLoading }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const issuedToday = invoices.filter(i => i.created_at?.slice(0, 10) === today);
  const unpaid = invoices.filter(i => (i.balance_due ?? 0) > 0 && !["paid", "paid_by_promo", "void", "cancelled"].includes(i.status ?? ""));
  const paid = invoices.filter(i => i.status === "paid" || i.status === "paid_by_promo");
  const partial = invoices.filter(i => i.status === "partially_paid");
  const voided = invoices.filter(i => i.status === "void" || i.status === "cancelled");
  const disputed = invoices.filter(i => i.status === "disputed");
  const renewals = invoices.filter(i => i.type === "renewal");
  const totalBilled = invoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const totalOutstanding = unpaid.reduce((s, i) => s + (i.balance_due ?? 0), 0);

  const kpis = [
    { label: "Aujourd'hui", value: issuedToday.length.toString(), icon: TrendingUp, color: "text-[#F8FAFC]" },
    { label: "Impayées", value: unpaid.length.toString(), icon: Clock, color: "text-amber-400" },
    { label: "Payées", value: paid.length.toString(), icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Partielles", value: partial.length.toString(), icon: DollarSign, color: "text-sky-400" },
    { label: "Annulées", value: voided.length.toString(), icon: XCircle, color: "text-[#94A3B8]" },
    { label: "En litige", value: disputed.length.toString(), icon: AlertTriangle, color: "text-orange-400" },
    { label: "Renouvellements", value: renewals.length.toString(), icon: RefreshCcw, color: "text-violet-400" },
    { label: "Solde impayé", value: fmtCAD(totalOutstanding), icon: DollarSign, color: "text-red-400" },
  ];

  return (
    <div className="grid grid-cols-4 xl:grid-cols-8 gap-2">
      {kpis.map(k => (
        <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <k.icon className={`h-3.5 w-3.5 ${k.color}`} />
            <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium">{k.label}</span>
          </div>
          <p className={`text-base font-bold tabular-nums ${k.color}`}>
            {isLoading ? "—" : k.value}
          </p>
        </div>
      ))}
    </div>
  );
}
