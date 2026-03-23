/**
 * EmployeePayments — Payment visibility + recording for employee portal.
 * Uses shared-ops canonical payment action (apply_payment_to_invoice RPC).
 */
import { CreditCard, Loader2, Clock, CheckCircle, ArrowUpRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { usePaymentsList } from "@/shared-ops";
import { StatusBadge } from "@/employee-app/components/StatusBadge";
import { fmtMoney } from "@/employee-app/components/InfoGrid";
import { RecordPaymentDialog } from "@/shared-ops/components/RecordPaymentDialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type PaymentTab = "pending" | "confirmed" | "all";

const TABS: { key: PaymentTab; label: string }[] = [
  { key: "pending", label: "En attente" },
  { key: "confirmed", label: "Confirmés" },
  { key: "all", label: "Tous" },
];

export default function EmployeePayments() {
  const [tab, setTab] = useState<PaymentTab>("pending");
  const { data: allPayments = [], isLoading, refetch } = usePaymentsList("live");
  const navigate = useNavigate();
  const [paymentTarget, setPaymentTarget] = useState<{
    invoiceId: string; customerId: string; invoiceNumber?: string; balanceDue?: number;
  } | null>(null);

  // Fetch unpaid invoices for quick payment recording
  const { data: unpaidInvoices = [] } = useQuery({
    queryKey: ["employee-unpaid-invoices"],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, customer_id, balance_due, total, status")
        .eq("environment", "live")
        .in("status", ["pending", "overdue"])
        .gt("balance_due", 0)
        .order("due_date", { ascending: true })
        .limit(50);
      return data ?? [];
    },
  });

  const payments = tab === "all" ? allPayments
    : tab === "pending" ? allPayments.filter(p => p.status === "pending")
    : allPayments.filter(p => p.status === "confirmed");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Paiements</h1>
          <p className="text-xs text-muted-foreground">Vue opérationnelle — enregistrement autorisé</p>
        </div>
      </div>

      {/* Quick-pay unpaid invoices */}
      {unpaidInvoices.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
          <p className="text-[11px] font-medium text-amber-400">Factures en attente de paiement</p>
          <div className="space-y-1">
            {unpaidInvoices.slice(0, 5).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-1">
                <span className="text-xs font-mono text-foreground">{inv.invoice_number} — {fmtMoney(inv.balance_due)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] gap-1"
                  onClick={() => setPaymentTarget({
                    invoiceId: inv.id,
                    customerId: inv.customer_id,
                    invoiceNumber: inv.invoice_number,
                    balanceDue: inv.balance_due ?? inv.total,
                  })}
                >
                  <Plus className="h-3 w-3" /> Paiement
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Payment recording dialog */}
      {paymentTarget && (
        <RecordPaymentDialog
          open={!!paymentTarget}
          onOpenChange={(o) => { if (!o) setPaymentTarget(null); }}
          invoiceId={paymentTarget.invoiceId}
          customerId={paymentTarget.customerId}
          invoiceNumber={paymentTarget.invoiceNumber}
          balanceDue={paymentTarget.balanceDue}
          portal="employee"
          onSuccess={() => {
            refetch();
            setPaymentTarget(null);
          }}
        />
      )}
    </div>
  );
}
