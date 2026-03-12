/**
 * Service lifecycle KPI header
 */
import type { AdminSubscription } from "@/core-app/hooks/useAdminSubscriptions";
import {
  Repeat, Clock, CheckCircle2, PauseCircle, XCircle,
  RefreshCcw, AlertTriangle, CalendarClock,
} from "lucide-react";

interface Props {
  subs: AdminSubscription[];
  isLoading: boolean;
}

function isDueSoon(dateStr: string | null, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);
  return d >= now && d <= future;
}

export function SubscriptionKPIHeader({ subs, isLoading }: Props) {
  const active = subs.filter(s => s.status === "active");
  const pending = subs.filter(s => s.status === "pending");
  const suspended = subs.filter(s => s.status === "suspended");
  const expired = subs.filter(s => s.status === "expired");
  const cancelled = subs.filter(s => s.status === "cancelled");
  const renewalsDue = subs.filter(s => s.status === "active" && isDueSoon(s.cycle_end_date, 7));
  const expiringSoon = subs.filter(s => s.status === "active" && isDueSoon(s.cycle_end_date, 3));

  const kpis = [
    { label: "Actifs", value: active.length, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "En attente", value: pending.length, icon: Clock, color: "text-amber-400" },
    { label: "Suspendus", value: suspended.length, icon: PauseCircle, color: "text-orange-400" },
    { label: "Expirés", value: expired.length, icon: XCircle, color: "text-[#94A3B8]" },
    { label: "Annulés", value: cancelled.length, icon: XCircle, color: "text-red-400" },
    { label: "Renouvellements ≤7j", value: renewalsDue.length, icon: RefreshCcw, color: "text-violet-400" },
    { label: "Expirent bientôt", value: expiringSoon.length, icon: AlertTriangle, color: "text-amber-400" },
    { label: "Total services", value: subs.length, icon: Repeat, color: "text-[#F8FAFC]" },
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
