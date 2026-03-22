/**
 * EmployeePayments — Payment operational handling with confirmation actions.
 * Sections: Manual pending, Confirmed, Failed.
 * READ-ONLY canonical amounts. Operational actions for pending payments.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Loader2, CheckCircle, XCircle, Clock, ArrowUpRight, User, FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { useNavigate, useSearchParams } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { ActionConfirmButton } from "@/employee-app/components/ActionConfirmDialog";

type PaymentTab = "manual" | "confirmed" | "failed";

const TABS: { key: PaymentTab; label: string; icon: typeof Clock }[] = [
  { key: "manual", label: "En attente", icon: Clock },
  { key: "confirmed", label: "Confirmés", icon: CheckCircle },
  { key: "failed", label: "Échoués", icon: XCircle },
];

interface PaymentRow {
  id: string;
  payment_number: string;
  amount: number;
  method: string;
  status: string | null;
  created_at: string | null;
  reference: string | null;
  customer_id: string;
  invoice_id: string;
  source: string | null;
  // joined
  customerName?: string | null;
  customerEmail?: string | null;
  customerUserId?: string | null;
  invoiceNumber?: string | null;
}

function useEmployeePayments(tab: PaymentTab) {
  return useQuery({
    queryKey: ["employee-payments-v2", tab],
    queryFn: async () => {
      let query = supabase
        .from("billing_payments")
        .select("id, payment_number, amount, method, status, created_at, reference, customer_id, invoice_id, source")
        .eq("environment", "live")
        .order("created_at", { ascending: false })
        .limit(50);

      switch (tab) {
        case "manual": query = query.eq("status", "pending"); break;
        case "confirmed": query = query.eq("status", "confirmed"); break;
        case "failed": query = query.in("status", ["failed", "declined", "cancelled"]); break;
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) return [];

      // Enrich with customer + invoice info
      const customerIds = [...new Set(data.map(p => p.customer_id).filter(Boolean))];
      const invoiceIds = [...new Set(data.map(p => p.invoice_id).filter(Boolean))];

      const [customersRes, invoicesRes] = await Promise.all([
        customerIds.length
          ? supabase.from("billing_customers").select("id, first_name, last_name, email, user_id").in("id", customerIds)
          : Promise.resolve({ data: [] }),
        invoiceIds.length
          ? supabase.from("billing_invoices").select("id, invoice_number").in("id", invoiceIds)
          : Promise.resolve({ data: [] }),
      ]);

      const custMap = new Map((customersRes.data ?? []).map(c => [c.id, c]));
      const invMap = new Map((invoicesRes.data ?? []).map(i => [i.id, i]));

      return data.map(p => {
        const cust = custMap.get(p.customer_id);
        const inv = invMap.get(p.invoice_id);
        return {
          ...p,
          customerName: cust ? `${cust.first_name} ${cust.last_name}` : null,
          customerEmail: cust?.email ?? null,
          customerUserId: cust?.user_id ?? null,
          invoiceNumber: inv?.invoice_number ?? null,
        } as PaymentRow;
      });
    },
    staleTime: 1000 * 60 * 2,
  });
}

export default function EmployeePayments() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<PaymentTab>("manual");
  const { data: payments = [], isLoading } = useEmployeePayments(tab);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const confirmMutation = useMutation({
    mutationFn: async ({ paymentId, action }: { paymentId: string; action: "confirm" | "reject" }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Non authentifié");

      const newStatus = action === "confirm" ? "confirmed" : "failed";
      const { error } = await supabase
        .from("billing_payments")
        .update({
          status: newStatus,
          confirmed_by: action === "confirm" ? session.user.id : null,
          source: "admin_confirm",
        })
        .eq("id", paymentId);
      if (error) throw error;

      // If confirming, also update invoice
      if (action === "confirm") {
        const payment = payments.find(p => p.id === paymentId);
        if (payment?.invoice_id) {
          await supabase
            .from("billing_invoices")
            .update({ status: "paid", paid_at: new Date().toISOString(), amount_paid: payment.amount, balance_due: 0 })
            .eq("id", payment.invoice_id);
        }
        // Update order payment_status if linked
        if (payment?.invoice_id) {
          const { data: inv } = await supabase.from("billing_invoices").select("order_id").eq("id", payment.invoice_id).maybeSingle();
          if (inv?.order_id) {
            await supabase.from("orders").update({ payment_status: "paid" }).eq("id", inv.order_id);
          }
        }
      }

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).maybeSingle();
      await supabase.from("activity_logs").insert({
        user_id: session.user.id,
        entity_id: paymentId,
        entity_type: "payment",
        action: action === "confirm" ? "Paiement confirmé" : "Paiement rejeté",
        actor_name: profile?.full_name ?? session.user.email ?? "Employé",
        actor_role: "employee",
      });
      await logInternalAudit({
        action: action === "confirm" ? "confirm_payment" : "reject_payment",
        category: "operations",
        portal: "employee",
        targetType: "payment",
        targetId: paymentId,
      });
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["employee-payments-v2"] });
      toast.success(action === "confirm" ? "Paiement confirmé" : "Paiement rejeté");
    },
    onError: (err: any) => toast.error(`Erreur: ${err.message}`),
  });

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
        <p className="text-sm text-muted-foreground">Gestion opérationnelle des paiements</p>
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
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Facture</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Montant</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Méthode</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  {tab === "manual" && (
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground font-medium">{p.payment_number}</td>
                    <td className="px-4 py-3">
                      {p.customerName ? (
                        <button
                          onClick={() => p.customerUserId && navigate(employeePath(`/clients/${p.customerUserId}`))}
                          className={cn("text-xs", p.customerUserId ? "text-primary hover:underline" : "text-muted-foreground")}
                        >
                          {p.customerName}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.invoiceNumber ? (
                        <span className="text-xs text-muted-foreground font-mono">{p.invoiceNumber}</span>
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
                    {tab === "manual" && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <ActionConfirmButton
                            label="Confirmer"
                            consequence="Confirmer ce paiement → la facture sera marquée payée et la commande mise à jour"
                            onConfirm={() => confirmMutation.mutate({ paymentId: p.id, action: "confirm" })}
                            isPending={confirmMutation.isPending}
                            variant="primary"
                          />
                          <ActionConfirmButton
                            label="Rejeter"
                            consequence="Rejeter ce paiement → il sera marqué comme échoué"
                            onConfirm={() => confirmMutation.mutate({ paymentId: p.id, action: "reject" })}
                            isPending={confirmMutation.isPending}
                            variant="warning"
                          />
                        </div>
                      </td>
                    )}
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
