import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Lock, Send, CreditCard, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { SquarePaymentForm } from "@/components/payment/SquarePaymentForm";

const INTERAC_EMAIL = "support@nivra-telecom.ca";

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
  onPaymentSuccess,
}: PayInvoiceDialogProps) => {
  const qc = useQueryClient();
  const [paid, setPaid] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<"card" | "interac">("card");

  if (!invoice) return null;

  const invoiceNumber = invoice.invoice_number || "—";
  const amount = totalDue;
  const accountNumber = profile?.account_number || profile?.ACCOUNT_NUMBER || "—";
  const customerName = profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "";
  const customerEmail = profile?.email || "";

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copié !`));

  const handleSquareSuccess = (url?: string | null) => {
    setPaid(true);
    setReceiptUrl(url || null);
    qc.invalidateQueries({ queryKey: ["canonical-client"] });
    qc.invalidateQueries({ queryKey: ["billing-hub-unpaid"] });
    qc.invalidateQueries({ queryKey: ["client-invoice-breakdowns"] });
    onPaymentSuccess?.();
  };

  if (paid) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            <h3 className="text-xl font-bold text-foreground">Paiement accepté !</h3>
            <p className="text-muted-foreground text-sm">
              {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} débité sur votre carte.
            </p>
            {receiptUrl && (
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-primary underline">
                Voir le reçu Square
              </a>
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

        {/* Tab selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab("card")}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === "card"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Carte de crédit
          </button>
          <button
            onClick={() => setTab("interac")}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === "interac"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40"
            }`}
          >
            <Send className="w-4 h-4" />
            Virement Interac
          </button>
        </div>

        {/* Card payment */}
        {tab === "card" && (
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
            <SquarePaymentForm
              invoiceId={invoice.id}
              amount={amount}
              invoiceNumber={invoiceNumber}
              customerName={customerName}
              customerEmail={customerEmail}
              onSuccess={handleSquareSuccess}
            />
            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" />
              Paiement sécurisé — Square PCI-DSS
            </p>
          </div>
        )}

        {/* Interac */}
        {tab === "interac" && (
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
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
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" />
              Traitement automatique dès réception
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PayInvoiceDialog;
