/**
 * Payment operations KPI header — financial dashboard strip
 */
import type { AdminPayment } from "@/core-app/hooks/useAdminPayments";
import { fmtCAD } from "./PaymentConstants";
import {
  DollarSign, Clock, ShieldCheck, CheckCircle2, XCircle,
  AlertTriangle, RotateCcw, TrendingUp,
} from "lucide-react";

interface Props {
  payments: AdminPayment[];
  isLoading: boolean;
}

export function PaymentKPIHeader({ payments, isLoading }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const todayPayments = payments.filter(p => p.created_at?.slice(0, 10) === today);
  const pending = payments.filter(p => p.status === "pending");
  const inVerification = payments.filter(p => p.status === "in_verification" || p.status === "manual_review");
  const confirmed = payments.filter(p => p.status === "confirmed" || p.status === "completed");
  const failed = payments.filter(p => p.status === "failed" || p.status === "declined");
  const fraud = payments.filter(p => p.status === "fraud");
  const refunded = payments.filter(p => p.status === "refunded" || p.status === "reversed");
  const amountToday = todayPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
  const amountPending = pending.reduce((s, p) => s + (p.amount ?? 0), 0);

  const kpis = [
    { label: "Aujourd'hui", value: todayPayments.length.toString(), sub: fmtCAD(amountToday), icon: TrendingUp, color: "text-white" },
    { label: "En attente", value: pending.length.toString(), sub: fmtCAD(amountPending), icon: Clock, color: "text-amber-400" },
    { label: "En vérification", value: inVerification.length.toString(), icon: ShieldCheck, color: "text-violet-400" },
    { label: "Confirmés", value: confirmed.length.toString(), icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Échoués", value: failed.length.toString(), icon: XCircle, color: "text-red-400" },
    { label: "Fraude", value: fraud.length.toString(), icon: AlertTriangle, color: "text-orange-400" },
    { label: "Remboursés", value: refunded.length.toString(), icon: RotateCcw, color: "text-sky-400" },
    { label: "Total traité", value: fmtCAD(confirmed.reduce((s, p) => s + (p.amount ?? 0), 0)), icon: DollarSign, color: "text-emerald-400" },
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
          {k.sub && !isLoading && (
            <p className="text-[10px] text-[#64748B] tabular-nums mt-0.5">{k.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
