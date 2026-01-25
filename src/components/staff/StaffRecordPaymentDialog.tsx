/**
 * StaffRecordPaymentDialog - Payment recording component for Employee Portal
 * Allows staff to record Interac e-transfer, cash, and manual payments
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, Loader2, Banknote, CreditCard, Send } from "lucide-react";

interface StaffRecordPaymentDialogProps {
  billingId: string;
  userId: string;
  balanceDue: number;
  invoiceNumber?: string;
  clientEmail?: string;
  onSuccess?: () => void;
}

const PAYMENT_METHODS = [
  { value: "interac", label: "Virement Interac", icon: Send, color: "text-teal-400" },
  { value: "cash", label: "Espèces", icon: Banknote, color: "text-emerald-400" },
  { value: "card", label: "Carte de crédit", icon: CreditCard, color: "text-blue-400", disabled: true },
];

export function StaffRecordPaymentDialog({
  billingId,
  userId,
  balanceDue,
  invoiceNumber,
  clientEmail,
  onSuccess,
}: StaffRecordPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("interac");
  const [amount, setAmount] = useState(balanceDue.toFixed(2));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const paymentAmount = parseFloat(amount) || 0;
      if (paymentAmount <= 0) {
        throw new Error("Le montant doit être supérieur à 0");
      }

      // Get current staff user info
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Non authentifié");

      let staffName = currentUser.email || "Staff";
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      if (profile?.full_name) {
        staffName = profile.full_name;
      }

      const refNumber = reference || `PAY-${Date.now().toString(36).toUpperCase()}`;

      // Insert payment record
      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          user_id: userId,
          amount: paymentAmount,
          payment_method: paymentMethod,
          reference_number: refNumber,
          payment_reference: refNumber,
          notes: notes || `Paiement enregistré par ${staffName}`,
          billing_id: billingId,
          status: "completed",
          source: "staff",
          created_by_id: currentUser.id,
          created_by_name: staffName,
          created_by_role: "employee",
        });

      if (paymentError) throw paymentError;

      // Update billing record
      const { data: billing } = await supabase
        .from("billing")
        .select("amount, amount_paid")
        .eq("id", billingId)
        .single();

      if (billing) {
        const newAmountPaid = (billing.amount_paid || 0) + paymentAmount;
        const newBalanceDue = Math.max(0, (billing.amount || 0) - newAmountPaid);
        const newStatus = newBalanceDue <= 0 ? "paid" : "partial";

        await supabase
          .from("billing")
          .update({
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            status: newStatus,
            paid_at: newStatus === "paid" ? new Date().toISOString() : null,
            payment_method_type: paymentMethod,
            payment_reference: refNumber,
          })
          .eq("id", billingId);
      }

      return { amount: paymentAmount, method: paymentMethod };
    },
    onSuccess: (data) => {
      toast.success(`Paiement de ${data.amount.toFixed(2)} $ enregistré avec succès`);
      queryClient.invalidateQueries({ queryKey: ["staff-billing-detail"] });
      queryClient.invalidateQueries({ queryKey: ["staff-billing"] });
      setOpen(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error("Erreur lors de l'enregistrement du paiement", {
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setAmount(balanceDue.toFixed(2));
    setPaymentMethod("interac");
    setReference("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white">
          <DollarSign className="h-4 w-4 mr-2" />
          Enregistrer un paiement
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-teal-400" />
            Enregistrer un paiement
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {invoiceNumber && <span>Facture: {invoiceNumber} • </span>}
            Solde dû: {balanceDue.toFixed(2)} $
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Payment Method */}
          <div className="space-y-2">
            <Label className="text-slate-300">Méthode de paiement</Label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.value}
                    type="button"
                    disabled={method.disabled}
                    onClick={() => setPaymentMethod(method.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                      paymentMethod === method.value
                        ? "border-teal-500 bg-teal-500/20"
                        : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
                    } ${method.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Icon className={`h-5 w-5 ${method.color}`} />
                    <span className="text-xs text-slate-300">{method.label}</span>
                  </button>
                );
              })}
            </div>
            {paymentMethod === "card" && (
              <p className="text-xs text-amber-400">Carte de crédit en maintenance</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-slate-300">Montant ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white"
            />
            {parseFloat(amount) > balanceDue && (
              <p className="text-xs text-amber-400">
                Montant supérieur au solde dû. Le surplus sera en crédit.
              </p>
            )}
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label htmlFor="reference" className="text-slate-300">
              Référence {paymentMethod === "interac" ? "(ID de transaction)" : "(optionnel)"}
            </Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={paymentMethod === "interac" ? "ex: INTERAC-ABC123" : "Référence"}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-slate-300">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes internes..."
              className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Annuler
          </Button>
          <Button
            onClick={() => recordPaymentMutation.mutate()}
            disabled={recordPaymentMutation.isPending || !amount || parseFloat(amount) <= 0}
            className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
          >
            {recordPaymentMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <DollarSign className="h-4 w-4 mr-2" />
            )}
            Confirmer {parseFloat(amount) > 0 ? `${parseFloat(amount).toFixed(2)} $` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
