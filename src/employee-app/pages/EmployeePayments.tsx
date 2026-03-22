/**
 * EmployeePayments — Phase 2: Rewired to shared-ops canonical layer.
 * READ-ONLY per staff-portal-billing-restriction policy.
 * Payment confirm/reject actions REMOVED — must go through Core.
 */
import { CreditCard, Loader2, CheckCircle, XCircle, Clock, User, FileText, AlertTriangle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { usePaymentsList } from "@/shared-ops";

type PaymentTab = "pending" | "confirmed" | "all";

const TABS: { key: PaymentTab; label: string; icon: typeof Clock }[] = [
  { key: "pending", label: "En attente", icon: Clock },
  { key: "confirmed", label: "Confirmés", icon: CheckCircle },
  { key: "all", label: "Tous", icon: CreditCard },
];

export default function EmployeePayments() {
  const [tab, setTab] = useState<PaymentTab>("pending");
  const { data: allPayments = [], isLoading } = usePaymentsList("live");
  const navigate = useNavigate();

  // Filter by tab client-side
  const payments = tab === "all"
    ? allPayments
    : tab === "pending"
      ? allPayments.filter(p => p.status === "pending")
      : allPayments.filter(p => p.status === "confirmed");

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: "text-amber-400 bg-amber-500/10",
      confirmed: "text-emerald-400 bg-emerald-500/10",
      failed: "text-red-400 bg-red-500/10",
      declined: "text-red-400 bg-red-500/10",
      cancelled: "text-muted-foreground bg-secondary",
    };
    return map[s] ?? "text-muted-foreground bg-secondary";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Paiements</h1>
        <p className="text-sm text-muted-foreground">Vue opérationnelle des paiements (lecture seule)</p>
      </div>

      {/* Policy notice */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span>Les confirmations et rejets de paiement doivent être effectués via Nivra Core.</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              tab === t.key
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
            )}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16">
          <CreditCard className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucun paiement dans cette catégorie.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Numéro</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Compte</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Facture</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Montant</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Méthode</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground font-medium">{p.payment_number}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.customer_name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{p.account_number ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.invoice_number ? (
                        <span className="text-xs text-muted-foreground font-mono">{p.invoice_number}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground font-medium">{p.amount.toFixed(2)} $</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.method}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", statusColor(p.status ?? ""))}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.created_at ? format(new Date(p.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
