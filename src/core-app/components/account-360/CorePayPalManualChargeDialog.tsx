/**
 * CorePayPalManualChargeDialog
 * Triggers paypal-charge-subscription edge function for an account that has
 * a PayPal billing agreement. Lets agent pick an unpaid invoice (or "Hors facture")
 * and a custom amount + description.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paypalSubscriptionId: string;
  billingSubscriptionId: string;
  unpaidInvoices: Array<{ id: string; invoice_number?: string | null; balance_due?: number | null; total?: number | null }>;
  accountId?: string;
  onSuccess?: () => void;
}

export const CorePayPalManualChargeDialog = ({
  open,
  onOpenChange,
  paypalSubscriptionId,
  billingSubscriptionId,
  unpaidInvoices,
  accountId,
  onSuccess,
}: Props) => {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [invoiceId, setInvoiceId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setAmount("");
    setDescription("");
    setInvoiceId("none");
  };

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Montant invalide");
      return;
    }
    if (!description.trim()) {
      toast.error("Description requise");
      return;
    }

    try {
      setSubmitting(true);
      const { data, error } = await supabase.functions.invoke("paypal-charge-subscription", {
        body: {
          subscription_id: billingSubscriptionId,
          invoice_id: invoiceId === "none" ? null : invoiceId,
          amount: amt,
          description: description.trim(),
        },
      });

      if (error) throw new Error(error.message || "Erreur PayPal");
      if (data?.error) throw new Error(data.error);

      // Activity log (best effort)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("activity_logs").insert({
          action: "manual_paypal_charge",
          entity_type: "billing_subscription",
          entity_id: billingSubscriptionId,
          user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
          actor_email: user?.email ?? null,
          details: {
            amount: amt,
            description: description.trim(),
            invoice_id: invoiceId === "none" ? null : invoiceId,
            paypal_subscription_id: paypalSubscriptionId,
            account_id: accountId ?? null,
          },
        });
      } catch (logErr) {
        console.warn("[ManualCharge] activity log failed", logErr);
      }

      toast.success(`Paiement de ${amt.toFixed(2)} $ traité via PayPal`);
      qc.invalidateQueries({ queryKey: ["account-profile-invoices"] });
      qc.invalidateQueries({ queryKey: ["account-profile-payments"] });
      qc.invalidateQueries({ queryKey: ["account-profile-subscriptions"] });
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(`Erreur PayPal: ${e?.message ?? e}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Charger manuellement via PayPal</DialogTitle>
          <DialogDescription>
            Le client a un paiement pré-autorisé PayPal. Cette action déclenche un prélèvement immédiat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="amount">Montant (CAD) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Frais d'activation, équipement, ajustement…"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="invoice">Facture liée</Label>
            <Select value={invoiceId} onValueChange={setInvoiceId} disabled={submitting}>
              <SelectTrigger id="invoice">
                <SelectValue placeholder="Sélectionner une facture" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Hors facture</SelectItem>
                {unpaidInvoices.map((inv) => {
                  const bal = Number(inv.balance_due ?? inv.total ?? 0);
                  return (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number ?? inv.id.slice(0, 8)} — {bal.toFixed(2)} $
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Charger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
