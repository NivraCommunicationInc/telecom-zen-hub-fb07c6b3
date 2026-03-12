/**
 * Invoice financial summary sidebar — period aggregates, renewal visibility
 */
import type { AdminInvoice } from "@/core-app/hooks/useAdminInvoices";
import { fmtCAD } from "./InvoiceConstants";

interface Props {
  invoices: AdminInvoice[];
}

function isWithinDays(dateStr: string | null, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
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

export function InvoiceFinancialSummary({ invoices }: Props) {
  const sum = (arr: AdminInvoice[], field: "total" | "balance_due" | "amount_paid") =>
    arr.reduce((s, i) => s + ((i as any)[field] ?? 0), 0);

  const last7 = invoices.filter(i => isWithinDays(i.created_at, 7));
  const last30 = invoices.filter(i => isWithinDays(i.created_at, 30));
  const dueSoon = invoices.filter(i => isDueSoon(i.due_date, 7) && (i.balance_due ?? 0) > 0);

  const initials = invoices.filter(i => i.type === "initial");
  const renewals = invoices.filter(i => i.type === "renewal");
  const notRenewed = invoices.filter(i => i.status === "not_renewed" || i.status === "void");

  const unpaid = invoices.filter(i => (i.balance_due ?? 0) > 0 && !["paid", "paid_by_promo", "void", "cancelled"].includes(i.status ?? ""));

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Résumé facturation</h3>

      <SummaryBlock title="7 derniers jours" items={[
        { label: "Factures émises", value: last7.length.toString() },
        { label: "Total facturé", value: fmtCAD(sum(last7, "total")), color: "text-[#F8FAFC]" },
        { label: "Total encaissé", value: fmtCAD(sum(last7, "amount_paid")), color: "text-emerald-400" },
        { label: "Solde impayé", value: fmtCAD(sum(last7.filter(i => (i.balance_due ?? 0) > 0), "balance_due")), color: "text-red-400" },
      ]} />

      <SummaryBlock title="30 derniers jours" items={[
        { label: "Factures émises", value: last30.length.toString() },
        { label: "Total facturé", value: fmtCAD(sum(last30, "total")), color: "text-[#F8FAFC]" },
        { label: "Total encaissé", value: fmtCAD(sum(last30, "amount_paid")), color: "text-emerald-400" },
      ]} />

      <SummaryBlock title="Échéances proches (7j)" items={[
        { label: "Factures dues", value: dueSoon.length.toString(), color: "text-amber-400" },
        { label: "Montant dû", value: fmtCAD(sum(dueSoon, "balance_due")), color: "text-amber-400" },
      ]} />

      <SummaryBlock title="Cycle prépayé" items={[
        { label: "Initiales", value: initials.length.toString() },
        { label: "Renouvellements", value: renewals.length.toString(), color: "text-violet-400" },
        { label: "Non renouvelées", value: notRenewed.length.toString(), color: "text-[#94A3B8]" },
      ]} />

      <SummaryBlock title="Solde global impayé" items={[
        { label: "Factures impayées", value: unpaid.length.toString(), color: "text-red-400" },
        { label: "Montant total", value: fmtCAD(sum(unpaid, "balance_due")), color: "text-red-400" },
      ]} />
    </div>
  );
}
