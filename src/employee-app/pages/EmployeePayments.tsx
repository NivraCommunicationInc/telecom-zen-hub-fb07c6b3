/**
 * EmployeePayments — Payment visibility + recording for employee portal.
 * Uses shared-ops canonical payment action (apply_payment_to_invoice RPC).
 */
import { CreditCard, Loader2, Clock, CheckCircle, ArrowUpRight, Plus, Wallet } from "lucide-react";
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
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

type PaymentTab = "pending" | "confirmed" | "all";

const TABS: { key: PaymentTab; label: string }[] = [
  { key: "pending", label: "En attente" },
  { key: "confirmed", label: "Confirmés" },
  { key: "all", label: "Tous" },
];

export default function EmployeePayments() {
  usePortalRealtime(["billing_payments", "billing_invoices"], [["employee-payments"]]);
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

  // Mes commissions (OneView CS — same logic as Field, surfaced in this portal)
  const { data: myCommissions = [], isLoading: loadingCommissions } = useQuery({
    queryKey: ["employee-my-commissions"],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("sales_commissions")
        .select("id, sale_amount, commission_rate, commission_amount, status, created_at, paid_at, notes, converted_order_id")
        .eq("salesperson_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const commStats = {
    pending:  myCommissions.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.commission_amount || 0), 0),
    approved: myCommissions.filter(c => ["approved","validated"].includes(c.status)).reduce((s, c) => s + Number(c.commission_amount || 0), 0),
    paid:     myCommissions.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.commission_amount || 0), 0),
    month:    myCommissions.filter(c => new Date(c.created_at).getTime() >= startOfMonth).reduce((s, c) => s + Number(c.commission_amount || 0), 0),
  };

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

      {/* Mes commissions (OneView CS sales) */}
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-bold text-violet-500">Mes commissions</h2>
          <span className="text-[10px] text-muted-foreground">(30% forfait · 5% équipement)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-md border border-border bg-card p-2">
            <div className="text-[9px] uppercase text-muted-foreground tracking-wider">En attente</div>
            <div className="text-base font-bold text-amber-500">{fmtMoney(commStats.pending)}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-2">
            <div className="text-[9px] uppercase text-muted-foreground tracking-wider">Approuvées</div>
            <div className="text-base font-bold text-blue-500">{fmtMoney(commStats.approved)}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-2">
            <div className="text-[9px] uppercase text-muted-foreground tracking-wider">Payées</div>
            <div className="text-base font-bold text-emerald-500">{fmtMoney(commStats.paid)}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-2">
            <div className="text-[9px] uppercase text-muted-foreground tracking-wider">Ce mois-ci</div>
            <div className="text-base font-bold text-violet-500">{fmtMoney(commStats.month)}</div>
          </div>
        </div>
        {loadingCommissions ? (
          <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-violet-500" /></div>
        ) : myCommissions.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-2">Aucune commission encore. Vendez via le CRM pour en gagner!</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {myCommissions.slice(0, 10).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-[11px] py-1 border-b border-border/40 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-muted-foreground truncate">{c.notes ?? "Commission"}</div>
                  <div className="text-[10px] text-muted-foreground/70">{format(new Date(c.created_at), "d MMM yyyy", { locale: fr })} · {(Number(c.commission_rate) * 100).toFixed(0)}%</div>
                </div>
                <div className="text-right ml-2">
                  <div className="font-bold">{fmtMoney(c.commission_amount)}</div>
                  <div className="text-[9px] text-muted-foreground uppercase">{c.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
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
