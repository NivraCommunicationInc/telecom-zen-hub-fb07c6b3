/**
 * Subscription renewal & lifecycle summary sidebar
 */
import type { AdminSubscription } from "@/core-app/hooks/useAdminSubscriptions";
import { fmtCAD } from "./SubscriptionConstants";

interface Props {
  subs: AdminSubscription[];
}

function isDueSoon(dateStr: string | null, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);
  return d >= now && d <= future;
}

function SummaryBlock({ title, items }: { title: string; items: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
      <h4 className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold mb-2">{title}</h4>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-[11px] text-[#94A3B8]">{item.label}</span>
            <span className={`text-[12px] font-semibold tabular-nums ${item.color || "text-[#F8FAFC]"}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SubscriptionSummary({ subs }: Props) {
  const active = subs.filter(s => s.status === "active");
  const mrr = active.reduce((s, sub) => s + (sub.plan_price ?? 0), 0);

  const due7 = active.filter(s => isDueSoon(s.cycle_end_date, 7));
  const due30 = active.filter(s => isDueSoon(s.cycle_end_date, 30));
  const expired = subs.filter(s => s.status === "expired");
  const cancelled = subs.filter(s => s.status === "cancelled");
  const suspended = subs.filter(s => s.status === "suspended");

  // Category breakdown
  const catBreakdown = active.reduce((acc, s) => {
    const c = s.service_category || "other";
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const catLabels: Record<string, string> = {
    internet: "Internet",
    tv: "Télévision",
    mobile: "Mobile",
    combo: "Combo",
    streaming: "Streaming",
    security: "Sécurité",
    other: "Autre",
  };

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Résumé services</h3>

      <SummaryBlock title="Revenus récurrents" items={[
        { label: "MRR (actifs)", value: fmtCAD(mrr), color: "text-emerald-400" },
        { label: "Services actifs", value: active.length.toString(), color: "text-emerald-400" },
        { label: "Auto-billing", value: active.filter(s => s.auto_billing_enabled).length.toString() },
      ]} />

      <SummaryBlock title="Renouvellements ≤7j" items={[
        { label: "Services à renouveler", value: due7.length.toString(), color: "text-violet-400" },
        { label: "Revenu en jeu", value: fmtCAD(due7.reduce((s, sub) => s + (sub.plan_price ?? 0), 0)), color: "text-violet-400" },
      ]} />

      <SummaryBlock title="Renouvellements ≤30j" items={[
        { label: "Services à renouveler", value: due30.length.toString(), color: "text-amber-400" },
        { label: "Revenu en jeu", value: fmtCAD(due30.reduce((s, sub) => s + (sub.plan_price ?? 0), 0)), color: "text-amber-400" },
      ]} />

      <SummaryBlock title="Par catégorie (actifs)" items={
        Object.entries(catBreakdown).map(([c, count]) => ({
          label: catLabels[c] || c,
          value: count.toString(),
        }))
      } />

      <SummaryBlock title="Services en difficulté" items={[
        { label: "Suspendus", value: suspended.length.toString(), color: "text-orange-400" },
        { label: "Annulés (J+10)", value: cancelled.length.toString(), color: "text-red-400" },
        { label: "Expirés (legacy)", value: expired.length.toString(), color: "text-[#94A3B8]" },
      ]} />
    </div>
  );
}
