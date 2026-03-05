/**
 * WorkbenchPaymentTab - Payments + Invoices + restricted actions
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, FileText, DollarSign } from "lucide-react";
import { canPerformAction } from "@/lib/workbenchRoles";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  order: any;
  billing: any[];
  billingInvoices: any[];
  role: string | null;
}

const PAY_STATUS: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-400", label: "En attente" },
  paid: { color: "bg-emerald-500/20 text-emerald-400", label: "Payé" },
  unpaid: { color: "bg-amber-500/20 text-amber-400", label: "Non payé" },
  partially_paid: { color: "bg-blue-500/20 text-blue-400", label: "Partiellement payé" },
  overdue: { color: "bg-red-500/20 text-red-400", label: "En retard" },
  voided: { color: "bg-muted text-muted-foreground", label: "Annulé" },
  captured: { color: "bg-emerald-500/20 text-emerald-400", label: "Capturé" },
  refunded: { color: "bg-red-500/20 text-red-400", label: "Remboursé" },
};

export function WorkbenchPaymentTab({ order, billing, billingInvoices, role }: Props) {
  return (
    <div className="space-y-6">
      {/* Order payment summary */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-teal-400" /> Résumé paiement
            </h3>
            <Badge className={PAY_STATUS[order?.payment_status]?.color || "bg-muted text-muted-foreground"}>
              {PAY_STATUS[order?.payment_status]?.label || order?.payment_status || "—"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Sous-total</p>
              <p className="text-white">{Number(order?.subtotal || 0).toFixed(2)} $</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">TPS</p>
              <p className="text-white">{Number(order?.tps_amount || 0).toFixed(2)} $</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">TVQ</p>
              <p className="text-white">{Number(order?.tvq_amount || 0).toFixed(2)} $</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total</p>
              <p className="text-white font-bold">{Number(order?.total_amount || 0).toFixed(2)} $</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Invoices */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-teal-400" /> Factures ({billingInvoices.length})
        </h3>
        {billingInvoices.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="py-4 text-center text-muted-foreground text-sm">Aucune facture</CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {billingInvoices.map((inv: any) => {
              const payments = inv.billing_payments || [];
              return (
                <Card key={inv.id} className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-sm text-white">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">
                          Échéance: {format(new Date(inv.due_date), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-white font-bold">{Number(inv.total || 0).toFixed(2)} $</p>
                        <Badge className={PAY_STATUS[inv.status]?.color || "bg-muted text-muted-foreground"}>
                          {PAY_STATUS[inv.status]?.label || inv.status}
                        </Badge>
                      </div>
                    </div>
                    {payments.length > 0 && (
                      <div className="mt-3 border-t border-slate-700/50 pt-2 space-y-1">
                        {payments.map((p: any) => (
                          <div key={p.id} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{p.method} — {p.reference || "—"}</span>
                            <span className="text-emerald-400">{Number(p.amount).toFixed(2)} $</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Legacy billing records */}
      {billing.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-teal-400" /> Paiements legacy ({billing.length})
          </h3>
          <div className="space-y-2">
            {billing.map((b: any) => (
              <Card key={b.id} className="bg-slate-800/50 border-slate-700/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-white">{b.payment_method_type || "—"}</p>
                      <p className="text-xs text-muted-foreground">{b.invoice_number || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white font-bold">{Number(b.amount || 0).toFixed(2)} $</p>
                      <Badge className={PAY_STATUS[b.status]?.color || "bg-muted text-muted-foreground"}>
                        {PAY_STATUS[b.status]?.label || b.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
