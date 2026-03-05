/**
 * WorkbenchPaymentTab - Payments + Invoices + restricted actions
 * Reads totals from orders.pricing_snapshot (server-side source of truth)
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

function getPricingValue(order: any, field: string, fallbackField?: string): number {
  // Prefer pricing_snapshot (server-side source of truth)
  const ps = order?.pricing_snapshot;
  if (ps && ps[field] != null) return Number(ps[field]);
  // Fallback to order columns
  if (fallbackField && order?.[fallbackField] != null) return Number(order[fallbackField]);
  if (order?.[field] != null) return Number(order[field]);
  return 0;
}

export function WorkbenchPaymentTab({ order, billing, billingInvoices, role }: Props) {
  const ps = order?.pricing_snapshot;
  const hasSnapshot = !!ps;

  const recurringSubtotal = getPricingValue(order, 'recurring_subtotal', 'subtotal');
  const oneTimeSubtotal = getPricingValue(order, 'one_time_subtotal');
  const discountTotal = getPricingValue(order, 'discount_total', 'discount_amount');
  const taxableBase = getPricingValue(order, 'taxable_base');
  const tpsAmount = getPricingValue(order, 'tps_amount');
  const tvqAmount = getPricingValue(order, 'tvq_amount');
  const grandTotal = getPricingValue(order, 'grand_total', 'total_amount');

  return (
    <div className="space-y-6">
      {/* Order payment summary — from pricing_snapshot */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Résumé paiement
              {hasSnapshot && (
                <Badge variant="outline" className="text-[10px] ml-1">serveur</Badge>
              )}
            </h3>
            <Badge className={PAY_STATUS[order?.payment_status]?.color || "bg-muted text-muted-foreground"}>
              {PAY_STATUS[order?.payment_status]?.label || order?.payment_status || "—"}
            </Badge>
          </div>

          {/* Detailed breakdown when pricing_snapshot exists */}
          {hasSnapshot ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Services récurrents</span>
                <span className="text-foreground">{recurringSubtotal.toFixed(2)} $</span>
              </div>
              {oneTimeSubtotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frais uniques</span>
                  <span className="text-foreground">{oneTimeSubtotal.toFixed(2)} $</span>
                </div>
              )}
              {discountTotal > 0 && (
                <div className="flex justify-between text-emerald-500">
                  <span>Rabais {ps?.promo_applied?.code ? `(${ps.promo_applied.code})` : ''}</span>
                  <span>-{discountTotal.toFixed(2)} $</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-muted-foreground">Base taxable</span>
                <span className="text-foreground">{taxableBase.toFixed(2)} $</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TPS (5%)</span>
                <span className="text-foreground">{tpsAmount.toFixed(2)} $</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TVQ (9.975%)</span>
                <span className="text-foreground">{tvqAmount.toFixed(2)} $</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">{grandTotal.toFixed(2)} $</span>
              </div>
            </div>
          ) : (
            /* Legacy fallback — flat columns */
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Sous-total</p>
                <p className="text-foreground">{Number(order?.subtotal || 0).toFixed(2)} $</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">TPS</p>
                <p className="text-foreground">{tpsAmount.toFixed(2)} $</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">TVQ</p>
                <p className="text-foreground">{tvqAmount.toFixed(2)} $</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total</p>
                <p className="text-foreground font-bold">{grandTotal.toFixed(2)} $</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Invoices */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Factures ({billingInvoices.length})
        </h3>
        {billingInvoices.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-4 text-center text-muted-foreground text-sm">Aucune facture</CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {billingInvoices.map((inv: any) => {
              const payments = inv.billing_payments || [];
              return (
                <Card key={inv.id} className="bg-card border-border">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-sm text-foreground">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">
                          Échéance: {format(new Date(inv.due_date), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-foreground font-bold">{Number(inv.total || 0).toFixed(2)} $</p>
                        <Badge className={PAY_STATUS[inv.status]?.color || "bg-muted text-muted-foreground"}>
                          {PAY_STATUS[inv.status]?.label || inv.status}
                        </Badge>
                      </div>
                    </div>
                    {payments.length > 0 && (
                      <div className="mt-3 border-t border-border pt-2 space-y-1">
                        {payments.map((p: any) => (
                          <div key={p.id} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{p.method} — {p.reference || "—"}</span>
                            <span className="text-emerald-500">{Number(p.amount).toFixed(2)} $</span>
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
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Paiements legacy ({billing.length})
          </h3>
          <div className="space-y-2">
            {billing.map((b: any) => (
              <Card key={b.id} className="bg-card border-border">
                <CardContent className="pt-4 pb-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-foreground">{b.payment_method_type || "—"}</p>
                      <p className="text-xs text-muted-foreground">{b.invoice_number || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-foreground font-bold">{Number(b.amount || 0).toFixed(2)} $</p>
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
