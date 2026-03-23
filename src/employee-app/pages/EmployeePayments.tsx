/**
 * EmployeePayments — Read-only payment visibility with click-through navigation.
 * Per billing-restriction policy, mutations go through Core only.
 */
import { CreditCard, Loader2, Clock, CheckCircle, Lock, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { usePaymentsList } from "@/shared-ops";
import { StatusBadge } from "@/employee-app/components/StatusBadge";
import { fmtMoney } from "@/employee-app/components/InfoGrid";

type PaymentTab = "pending" | "confirmed" | "all";

const TABS: { key: PaymentTab; label: string }[] = [
  { key: "pending", label: "En attente" },
  { key: "confirmed", label: "Confirmés" },
  { key: "all", label: "Tous" },
];

export default function EmployeePayments() {
  const [tab, setTab] = useState<PaymentTab>("pending");
  const { data: allPayments = [], isLoading } = usePaymentsList("live");
  const navigate = useNavigate();

  const payments = tab === "all" ? allPayments
    : tab === "pending" ? allPayments.filter(p => p.status === "pending")
    : allPayments.filter(p => p.status === "confirmed");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Paiements</h1>
        <p className="text-xs text-muted-foreground">Vue opérationnelle (lecture seule)</p>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-400">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span>Les confirmations de paiement doivent être effectuées via Nivra Core.</span>
      </div>

      <div className="flex gap-1.5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
              tab === t.key ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-transparent hover:bg-secondary"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16">
          <CreditCard className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Aucun paiement.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Numéro", "Client", "Facture", "Montant", "Méthode", "Statut", "Date", ""].map(h => (
                    <th key={h} className={cn("px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider", h === "" ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                    onClick={() => p.invoice_id && navigate(employeePath(`/invoices/${p.invoice_id}`))}>
                    <td className="px-3 py-2 font-mono text-foreground font-medium">{p.payment_number}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {p.customer_name ? (
                        <button onClick={(e) => { e.stopPropagation(); p.customer_id && navigate(employeePath(`/clients/${p.customer_id}`)); }}
                          className="hover:text-primary transition-colors">{p.customer_name}</button>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{p.invoice_number ?? "—"}</td>
                    <td className="px-3 py-2 text-foreground font-medium">{fmtMoney(p.amount)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.method}</td>
                    <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-2 text-muted-foreground">{p.created_at ? format(new Date(p.created_at), "d MMM yyyy", { locale: fr }) : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground/50" />
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
