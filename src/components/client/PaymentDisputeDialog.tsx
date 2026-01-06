import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { AlertTriangle, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type ReasonCode = "duplicate_charge" | "incorrect_amount" | "service_not_received" | "unauthorized" | "fraud" | "other";

const reasonCodeLabels: Record<ReasonCode, { fr: string; en: string }> = {
  duplicate_charge: { fr: "Frais en double", en: "Duplicate charge" },
  incorrect_amount: { fr: "Montant incorrect", en: "Incorrect amount" },
  service_not_received: { fr: "Service non reçu", en: "Service not received" },
  unauthorized: { fr: "Paiement non autorisé", en: "Unauthorized payment" },
  fraud: { fr: "Fraude suspectée", en: "Suspected fraud" },
  other: { fr: "Autre raison", en: "Other reason" },
};

interface PaymentDisputeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: any;
}

const PaymentDisputeDialog = ({ open, onOpenChange, payment }: PaymentDisputeDialogProps) => {
  const { user } = useClientAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"form" | "success">("form");
  const [disputeNumber, setDisputeNumber] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    reason_code: "" as ReasonCode | "",
    client_message: "",
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !payment?.id || !formData.reason_code) {
        throw new Error("Données manquantes");
      }

      const { data, error } = await portalSupabase
        .from("payment_disputes")
        .insert({
          user_id: user.id,
          payment_id: payment.id,
          reason_code: formData.reason_code,
          client_message: formData.client_message || null,
        })
        .select("dispute_number")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setDisputeNumber(data.dispute_number);
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["client-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["client-invoices-all"] });
    },
    onError: (error: any) => {
      console.error("Dispute submission error:", error);
      toast.error("Erreur lors de la soumission de la contestation");
    },
  });

  const handleSubmit = () => {
    if (!formData.reason_code) {
      toast.error("Veuillez sélectionner une raison");
      return;
    }
    submitMutation.mutate();
  };

  const handleClose = () => {
    setStep("form");
    setFormData({ reason_code: "", client_message: "" });
    setDisputeNumber(null);
    onOpenChange(false);
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Contester un paiement
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Payment Info */}
              <div className="p-3 bg-accent/50 rounded-lg text-sm">
                <p className="font-medium">Facture: {payment.invoice_number || payment.id?.slice(0, 8)}</p>
                <p className="text-muted-foreground">
                  Montant: {Number(payment.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
                <p className="text-muted-foreground">
                  Date: {payment.created_at ? format(new Date(payment.created_at), "d MMMM yyyy", { locale: fr }) : "-"}
                </p>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Raison de la contestation *</Label>
                <Select
                  value={formData.reason_code}
                  onValueChange={(val) => setFormData({ ...formData, reason_code: val as ReasonCode })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez une raison" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(reasonCodeLabels).map(([code, labels]) => (
                      <SelectItem key={code} value={code}>
                        {labels.fr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label>Message (optionnel)</Label>
                <Textarea
                  value={formData.client_message}
                  onChange={(e) => setFormData({ ...formData, client_message: e.target.value })}
                  placeholder="Décrivez votre situation en détail..."
                  rows={4}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Une fois soumise, votre contestation sera examinée par notre équipe. 
                Vous serez notifié de toute mise à jour.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={submitMutation.isPending || !formData.reason_code}>
                {submitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Soumettre
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-500">
                <CheckCircle className="w-5 h-5" />
                Contestation soumise
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-center py-4">
              <div className="p-4 bg-emerald-500/10 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Numéro de contestation</p>
                <p className="text-xl font-mono font-bold">{disputeNumber}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Votre contestation a été reçue. Notre équipe l'examinera et vous contactera si des informations supplémentaires sont nécessaires.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Fermer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDisputeDialog;
