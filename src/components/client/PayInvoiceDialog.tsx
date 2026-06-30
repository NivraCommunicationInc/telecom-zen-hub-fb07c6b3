import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Lock, Send, CreditCard, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const INTERAC_EMAIL = "support@nivra-telecom.ca";
const BACKEND_URL = "https://lacxnbjvcyvhrttprkxr.supabase.co";
const BACKEND_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhY3huYmp2Y3l2aHJ0dHBya3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjI2NjMsImV4cCI6MjA5NTk5ODY2M30.Jcc89WC7CofMuMc9IRpxzsDsEb-_C7AVgLEbNzdLa2g";

interface PayInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  totalDue: number;
  profile: any;
  customerId?: string;
  squareCardId?: string | null;
  onPaymentSuccess?: () => void;
}

const PayInvoiceDialog = ({
  open,
  onOpenChange,
  invoice,
  totalDue,
  profile,
  customerId,
  squareCardId,
  onPaymentSuccess,
}: PayInvoiceDialogProps) => {
  const qc = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  if (!invoice) return null;

  const invoiceNumber = invoice.invoice_number || "—";
  const amount = totalDue;
  const accountNumber = profile?.account_number || profile?.ACCOUNT_NUMBER || "—";
  const hasCard = !!squareCardId;

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copié !`));

  const handleSquarePay = async () => {
    if (!customerId || !invoice?.id) return;
    setPaying(true);
    try {
      const res = await fetch(`${BACKEND_URL}/functions/v1/square-pay-invoice`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BACKEND_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoice_id: invoice.id, customer_id: customerId }),
      });
      const data = await res.json();
      if (!data?.ok) {
        toast.error(data?.error || "Paiement échoué");
        return;
      }
      setPaid(true);
      setReceiptUrl(data.receipt_url || null);
      toast.success("Paiement par carte réussi !");
      qc.invalidateQueries({ queryKey: ["canonical-client"] });
      qc.invalidateQueries({ queryKey: ["billing-hub-unpaid"] });
      onPaymentSuccess?.();
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setPaying(false);
    }
  };

  if (paid) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            <h3 className="text-xl font-bold text-foreground">Paiement réussi !</h3>
            <p className="text-muted-foreground text-sm">
              {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} débité sur votre carte.
            </p>
            {receiptUrl && (
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-primary underline">Voir le reçu Square</a>
            )}
            <Button onClick={() => onOpenChange(false)} className="mt-2">Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Payer la facture</DialogTitle>
        </DialogHeader>

        {/* Invoice summary */}
        <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Facture</span>
            <span className="font-mono font-semibold text-foreground">{invoiceNumber}</span>
          </div>
          {invoice.due_date && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Échéance</span>
              <span className="text-sm text-foreground">
                {format(new Date(invoice.due_date), "d MMMM yyyy", { locale: fr })}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm font-medium text-foreground">Solde à payer</span>
            <span className="text-2xl font-bold text-foreground">
              {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {/* Option 1 — Square (primary) */}
          <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">Carte de crédit</p>
                <p className="text-xs text-muted-foreground">Paiement immédiat et sécurisé</p>
              </div>
              <Badge className="bg-primary/10 text-primary border-0 text-xs">Recommandé</Badge>
            </div>

            {hasCard ? (
              <Button onClick={handleSquarePay} disabled={paying} className="w-full">
                {paying
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Traitement...</>
                  : <><CreditCard className="w-4 h-4 mr-2" />Payer {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} par carte</>}
              </Button>
            ) : (
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">Aucune carte enregistrée.</p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/portal/paiement">Enregistrer une carte →</a>
                </Button>
              </div>
            )}
          </div>

          {/* Option 2 — Interac */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Virement Interac</p>
                <p className="text-xs text-muted-foreground">Traitement sous 24–48 h</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background divide-y divide-border">
              <div className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-xs text-muted-foreground">Courriel</p>
                  <p className="text-sm font-semibold text-foreground">{INTERAC_EMAIL}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copy(INTERAC_EMAIL, "Courriel")}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-xs text-muted-foreground">Montant</p>
                  <p className="text-sm font-semibold text-foreground">
                    {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copy(amount.toFixed(2), "Montant")}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-xs text-muted-foreground">Réponse sécurité</p>
                  <p className="text-sm font-bold text-foreground">{accountNumber}</p>
                  <p className="text-xs text-amber-600">⚠️ Exactement ce numéro</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copy(String(accountNumber), "Numéro")}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <Lock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Paiements traités automatiquement — aucune intervention requise après réception.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PayInvoiceDialog;
