/**
 * Financial summary sidebar — 7d/30d aggregates, verification totals
 */
import type { AdminPayment } from "@/core-app/hooks/useAdminPayments";
import { fmtCAD } from "./PaymentConstants";

interface Props {
  payments: AdminPayment[];
}

function isWithinDays(dateStr: string | null, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
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

export function PaymentFinancialSummary({ payments }: Props) {
  const confirmed = (ps: AdminPayment[]) => ps.filter(p => p.status === "confirmed" || p.status === "completed");
  const pending = (ps: AdminPayment[]) => ps.filter(p => p.status === "pending");
  const failed = (ps: AdminPayment[]) => ps.filter(p => p.status === "failed" || p.status === "declined");
  const refunded = (ps: AdminPayment[]) => ps.filter(p => p.status === "refunded" || p.status === "reversed");
  const suspicious = (ps: AdminPayment[]) => ps.filter(p => p.status === "fraud");
  const sum = (ps: AdminPayment[]) => ps.reduce((s, p) => s + (p.amount ?? 0), 0);

  const last7 = payments.filter(p => isWithinDays(p.created_at, 7));
  const last30 = payments.filter(p => isWithinDays(p.created_at, 30));

  // Method breakdown
  const methodBreakdown = payments.reduce((acc, p) => {
    const m = p.method || "other";
    acc[m] = (acc[m] || 0) + (p.amount ?? 0);
    return acc;
  }, {} as Record<string, number>);

  const methodLabels: Record<string, string> = {
    paypal: "PayPal",
    interac: "Interac",
    manual: "Manuel",
    other: "Autre",
  };

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Résumé financier</h3>

      <SummaryBlock title="7 derniers jours" items={[
        { label: "Confirmés", value: fmtCAD(sum(confirmed(last7))), color: "text-emerald-400" },
        { label: "En attente", value: fmtCAD(sum(pending(last7))), color: "text-amber-400" },
        { label: "Échoués", value: fmtCAD(sum(failed(last7))), color: "text-red-400" },
        { label: "Remboursés", value: fmtCAD(sum(refunded(last7))), color: "text-sky-400" },
        { label: "Transactions", value: last7.length.toString() },
      ]} />

      <SummaryBlock title="30 derniers jours" items={[
        { label: "Confirmés", value: fmtCAD(sum(confirmed(last30))), color: "text-emerald-400" },
        { label: "En attente", value: fmtCAD(sum(pending(last30))), color: "text-amber-400" },
        { label: "Échoués", value: fmtCAD(sum(failed(last30))), color: "text-red-400" },
        { label: "Suspects", value: suspicious(last30).length.toString(), color: "text-orange-400" },
        { label: "Transactions", value: last30.length.toString() },
      ]} />

      <SummaryBlock title="Par méthode (total)" items={
        Object.entries(methodBreakdown).map(([m, amt]) => ({
          label: methodLabels[m] || m,
          value: fmtCAD(amt),
        }))
      } />

      <SummaryBlock title="Vérification en attente" items={[
        { label: "Transferts Interac", value: pending(payments).filter(p => p.method === "interac").length.toString(), color: "text-amber-400" },
        { label: "Manuels", value: pending(payments).filter(p => p.method === "manual").length.toString(), color: "text-amber-400" },
        { label: "Montant total", value: fmtCAD(sum(pending(payments))), color: "text-amber-400" },
      ]} />
    </div>
  );
}
