/**
 * Payment operations KPI — encaissé aujourd'hui / semaine / mois + échecs mois
 */
import type { AdminPayment } from "@/core-app/hooks/useAdminPayments";
import { fmtCAD } from "./PaymentConstants";
import { TrendingUp, CalendarDays, CalendarRange, XCircle, Clock, ShieldCheck } from "lucide-react";

interface Props {
  payments: AdminPayment[];
  isLoading: boolean;
}

const isConfirmed = (s: string | null) => s === "confirmed" || s === "completed";
const isFailed = (s: string | null) => s === "failed" || s === "declined";

export function PaymentKPIHeader({ payments, isLoading }: Props) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay(); // 0 Sun
  const diff = (day === 0 ? -6 : 1) - day;
  startOfWeek.setDate(startOfWeek.getDate() + diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const sum = (arr: AdminPayment[]) => arr.reduce((s, p) => s + (p.amount ?? 0), 0);
  const dateOf = (p: AdminPayment) => new Date(p.received_at || p.created_at || 0);

  const todayList = payments.filter(p => isConfirmed(p.status) && (p.received_at || p.created_at || "").slice(0, 10) === today);
  const weekList = payments.filter(p => isConfirmed(p.status) && dateOf(p) >= startOfWeek);
  const monthList = payments.filter(p => isConfirmed(p.status) && dateOf(p) >= startOfMonth);
  const failedMonth = payments.filter(p => isFailed(p.status) && dateOf(p) >= startOfMonth);
  const pending = payments.filter(p => p.status === "pending");
  const inVerif = payments.filter(p => p.status === "in_verification" || p.status === "manual_review");

  const kpis = [
    { label: "Encaissé aujourd'hui", value: fmtCAD(sum(todayList)), sub: `${todayList.length} paiement${todayList.length !== 1 ? "s" : ""}`, icon: TrendingUp, color: "text-emerald-400" },
    { label: "Encaissé cette semaine", value: fmtCAD(sum(weekList)), sub: `${weekList.length} paiement${weekList.length !== 1 ? "s" : ""}`, icon: CalendarDays, color: "text-emerald-400" },
    { label: "Encaissé ce mois", value: fmtCAD(sum(monthList)), sub: `${monthList.length} paiement${monthList.length !== 1 ? "s" : ""}`, icon: CalendarRange, color: "text-emerald-400" },
    { label: "Échecs ce mois", value: failedMonth.length.toString(), sub: fmtCAD(sum(failedMonth)), icon: XCircle, color: "text-red-400" },
    { label: "En attente", value: pending.length.toString(), sub: fmtCAD(sum(pending)), icon: Clock, color: "text-amber-400" },
    { label: "À vérifier", value: inVerif.length.toString(), sub: fmtCAD(sum(inVerif)), icon: ShieldCheck, color: "text-violet-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
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
