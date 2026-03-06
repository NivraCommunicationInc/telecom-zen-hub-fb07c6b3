/**
 * WorkbenchPaymentTab V2 — Full operational payment management
 * Confirm / Fail / Review payment, invoice access, billing breakdown
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CreditCard, FileText, DollarSign, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { canPerformAction } from "@/lib/workbenchRoles";
import { format } from "date-fns";

interface Props {
  order: any;
  billing: any[];
  billingInvoices: any[];
  role: string | null;
  onConfirmPayment: (reference: string, method: string, amount: number) => Promise<void>;
  onFailPayment: (reason: string) => Promise<void>;
}

const PAY_STATUS: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-400", label: "En attente" },
  paid: { color: "bg-emerald-500/20 text-emerald-400", label: "Payé" },
  unpaid: { color: "bg-amber-500/20 text-amber-400", label: "Non payé" },
  partially_paid: { color: "bg-blue-500/20 text-blue-400", label: "Partiellement payé" },
  voided: { color: "bg-muted text-muted-foreground", label: "Annulé" },
  captured: { color: "bg-emerald-500/20 text-emerald-400", label: "Capturé" },
  pre_authorized: { color: "bg-blue-500/20 text-blue-400", label: "Pré-autorisé" },
  failed: { color: "bg-red-500/20 text-red-400", label: "Échoué" },
};

function getPricingValue(order: any, field: string, fallbackField?: string): number {
  const ps = order?.pricing_snapshot;
  if (ps && ps[field] != null) return Number(ps[field]);
  if (fallbackField && order?.[fallbackField] != null) return Number(order[fallbackField]);
  if (order?.[field] != null) return Number(order[field]);
  return 0;
}

export function WorkbenchPaymentTab({ order, billing, billingInvoices, role, onConfirmPayment, onFailPayment }: Props) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showFailDialog, setShowFailDialog] = useState(false);
  const [payRef, setPayRef] = useState(order?.payment_reference || "");
  const [payMethod, setPayMethod] = useState(order?.payment_method || "interac");
  const [payAmount, setPayAmount] = useState(String(getPricingValue(order, "grand_total", "total_amount")));
  const [failReason, setFailReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const ps = order?.pricing_snapshot;
  const hasSnapshot = !!ps;
  const grandTotal = getPricingValue(order, "grand_total", "total_amount");
  const paymentStatus = order?.payment_status || "pending";
  const canConfirm = canPerformAction(role, "capture_payment") && !["paid", "captured"].includes(paymentStatus);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirmPayment(payRef, payMethod, Number(payAmount));
      setShowConfirmDialog(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFail = async () => {
    setIsProcessing(true);
    try {
      await onFailPayment(failReason);
      setShowFailDialog(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Payment Summary + Actions */}
      <div className="border border-border rounded-lg bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> Paiement
          </h3>
          <div className="flex items-center gap-2">
            <Badge className={PAY_STATUS[paymentStatus]?.color || "bg-muted"}>
              {PAY_STATUS[paymentStatus]?.label || paymentStatus}
            </Badge>
            {canConfirm && (
              <>
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowConfirmDialog(true)}>
                  <CheckCircle className="h-3 w-3 mr-1" /> Confirmer
                </Button>
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setShowFailDialog(true)}>
                  <XCircle className="h-3 w-3 mr-1" /> Échouer
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Breakdown */}
        {hasSnapshot ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Récurrent</span><span>{getPricingValue(order, "recurring_subtotal").toFixed(2)} $</span></div>
            {getPricingValue(order, "one_time_subtotal") > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Frais uniques</span><span>{getPricingValue(order, "one_time_subtotal").toFixed(2)} $</span></div>
            )}
            {getPricingValue(order, "discount_total") > 0 && (
              <div className="flex justify-between text-emerald-500"><span>Rabais</span><span>-{getPricingValue(order, "discount_total").toFixed(2)} $</span></div>
            )}
            <div className="border-t border-border pt-2 flex justify-between"><span className="text-muted-foreground">TPS (5%)</span><span>{getPricingValue(order, "tps_amount").toFixed(2)} $</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TVQ (9.975%)</span><span>{getPricingValue(order, "tvq_amount").toFixed(2)} $</span></div>
            <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground"><span>Total</span><span>{grandTotal.toFixed(2)} $</span></div>
          </div>
        ) : (
          <div className="flex justify-between font-bold text-foreground">
            <span>Total</span><span>{grandTotal.toFixed(2)} $</span>
          </div>
        )}

        {/* Payment details */}
        {order?.payment_reference && (
          <div className="mt-3 p-2 rounded bg-muted text-xs">
            <span className="text-muted-foreground">Référence: </span>
            <span className="font-mono text-foreground">{order.payment_reference}</span>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="border border-border rounded-lg bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Factures ({billingInvoices.length})
        </h3>
        {billingInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune facture liée</p>
        ) : (
          <div className="space-y-2">
            {billingInvoices.map((inv: any) => {
              const payments = inv.billing_payments || [];
              return (
                <div key={inv.id} className="p-3 rounded bg-muted/50 border border-border">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono text-sm text-foreground">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">Échéance: {format(new Date(inv.due_date), "dd/MM/yyyy")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{Number(inv.total || 0).toFixed(2)} $</p>
                      <Badge className={PAY_STATUS[inv.status]?.color || "bg-muted"}>
                        {PAY_STATUS[inv.status]?.label || inv.status}
                      </Badge>
                    </div>
                  </div>
                  {inv.balance_due > 0 && (
                    <p className="text-xs text-amber-400 mt-1">Solde dû: {Number(inv.balance_due).toFixed(2)} $</p>
                  )}
                  {payments.length > 0 && (
                    <div className="mt-2 border-t border-border pt-2 space-y-1">
                      {payments.map((p: any) => (
                        <div key={p.id} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{p.method} — {p.reference || "—"}</span>
                          <span className="text-emerald-500">{Number(p.amount).toFixed(2)} $</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm Payment Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmer le paiement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Méthode</label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interac">Interac</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="credit_card">Carte de crédit</SelectItem>
                  <SelectItem value="cash">Comptant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Référence de paiement</label>
              <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Numéro de transaction…" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Montant</label>
              <Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Annuler</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirm} disabled={isProcessing || !payRef.trim()}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fail Payment Dialog */}
      <Dialog open={showFailDialog} onOpenChange={setShowFailDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marquer le paiement comme échoué</DialogTitle></DialogHeader>
          <Textarea placeholder="Raison de l'échec…" value={failReason} onChange={e => setFailReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFailDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleFail} disabled={isProcessing || !failReason.trim()}>
              Confirmer l'échec
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
