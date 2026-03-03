import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banknote, Mail, Copy, Check, Info, CreditCard, Wrench } from "lucide-react";
import { toast } from "sonner";
import { ETRANSFER_CONFIG } from "@/config/company";
import { PayPalButton } from "@/components/payment/PayPalButton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PayInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  totalDue: number;
  profile: any;
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
  const [paymentMethod, setPaymentMethod] = useState<"interac" | "paypal" | null>(null);
  const [copied, setCopied] = useState(false);

  if (!invoice) return null;

  const invoiceNumber = invoice.invoice_number || invoice.id?.slice(0, 8).toUpperCase();
  const amount = totalDue;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(ETRANSFER_CONFIG.email);
    setCopied(true);
    toast.success("Courriel copié!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePayPalSuccess = (captureId: string) => {
    toast.success("Paiement PayPal effectué avec succès!");
    onOpenChange(false);
    onPaymentSuccess?.();
  };

  const handlePayPalError = (error: string) => {
    toast.error(`Erreur PayPal: ${error}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            Payer la facture
          </DialogTitle>
        </DialogHeader>

        {/* Invoice Summary */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Facture</span>
            <span className="font-mono font-semibold text-slate-900">{invoiceNumber}</span>
          </div>
          {invoice.due_date && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Échéance</span>
              <span className="text-sm text-slate-700">
                {format(new Date(invoice.due_date), "d MMMM yyyy", { locale: fr })}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-sm font-medium text-slate-700">Montant à payer</span>
            <span className="text-2xl font-bold text-slate-900">
              {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
            </span>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Choisir un mode de paiement</p>

          {/* Interac */}
          <button
            onClick={() => setPaymentMethod("interac")}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
              paymentMethod === "interac"
                ? "border-emerald-500 bg-emerald-50"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <Banknote className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">Virement Interac</p>
              <p className="text-xs text-slate-500">Envoyez un virement par votre banque</p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Recommandé</Badge>
          </button>

          {/* PayPal */}
          <button
            onClick={() => setPaymentMethod("paypal")}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
              paymentMethod === "paypal"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M19.554 9.488c.121.563.106 1.246-.04 2.017-.582 2.464-2.477 3.88-5.336 3.88h-.71c-.323 0-.6.216-.665.524l-.513 3.292-.146.935c-.033.211.127.403.34.403h2.398c.283 0 .526-.19.581-.468l.024-.123.46-2.922.03-.163c.055-.278.298-.468.58-.468h.367c2.369 0 4.221-1.042 4.762-4.057.226-1.261.11-2.314-.488-3.054a2.57 2.57 0 0 0-.644-.563c.138.244.252.505.34.78z" fill="#179BD7"/>
                <path d="M18.474 9.081a5.97 5.97 0 0 0-.74-.195 9.456 9.456 0 0 0-1.505-.11h-4.562c-.283 0-.526.19-.581.467l-.973 6.17-.028.18c.065-.308.342-.524.665-.524h1.386c2.84 0 5.062-1.155 5.713-4.495.019-.099.036-.195.05-.289a3.09 3.09 0 0 0-.425-.204z" fill="#222D65"/>
                <path d="M10.663 9.243a.595.595 0 0 1 .58-.467h4.563c.541 0 1.047.037 1.505.11.129.02.254.045.375.073.128.03.25.063.365.1.058.018.113.038.168.058a3.1 3.1 0 0 1 .257.103c.086-.55.085-1.106-.027-1.648-.376-1.822-1.667-2.573-3.612-2.573h-5.8c-.323 0-.6.216-.665.524L6.67 17.403c-.04.253.152.48.408.48h2.972l.746-4.733.867-3.907z" fill="#253B80"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">PayPal</p>
              <p className="text-xs text-slate-500">PayPal, carte de crédit ou débit</p>
            </div>
          </button>

          {/* Carte de crédit — maintenance */}
          <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed">
            <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-500">Carte de crédit</p>
              <p className="text-xs text-slate-400">Temporairement indisponible</p>
            </div>
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs gap-1">
              <Wrench className="w-3 h-3" />
              Maintenance
            </Badge>
          </div>
        </div>

        {/* Payment Details Based on Selection */}
        {paymentMethod === "interac" && (
          <div className="space-y-3 mt-2">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-sm font-medium text-slate-900 mb-3">
                Envoyez votre virement Interac à :
              </p>
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-200">
                <Mail className="w-5 h-5 text-emerald-600" />
                <span className="font-mono text-base flex-1">{ETRANSFER_CONFIG.emailDisplay}</span>
                <Button variant="outline" size="sm" onClick={handleCopyEmail} className="gap-1.5 shrink-0">
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copié!</> : <><Copy className="w-3.5 h-3.5" /> Copier</>}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Question de sécurité</p>
                <p className="text-sm font-medium text-slate-900">{ETRANSFER_CONFIG.securityQuestion}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Réponse</p>
                <p className="text-sm font-medium text-slate-900">{ETRANSFER_CONFIG.securityAnswer}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Montant exact à envoyer</p>
              <p className="text-lg font-bold text-slate-900">
                {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </p>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600">
                Incluez votre numéro de facture <strong>{invoiceNumber}</strong> dans le message du virement.
                Le paiement sera traité automatiquement dès réception.
              </p>
            </div>
          </div>
        )}

        {paymentMethod === "paypal" && (
          <div className="space-y-3 mt-2">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-slate-600 mb-4">
                Payez de façon sécurisée avec votre compte PayPal ou carte de crédit/débit.
              </p>
              <PayPalButton
                amount={amount}
                invoiceId={invoice.id}
                description={`Facture ${invoiceNumber} - Nivra Telecom`}
                customer={{
                  first_name: profile?.full_name?.split(" ")[0] || "",
                  last_name: profile?.full_name?.split(" ").slice(1).join(" ") || "",
                  email: profile?.email || "",
                  phone: profile?.phone || "",
                }}
                onSuccess={handlePayPalSuccess}
                onError={handlePayPalError}
                onCancel={() => toast.info("Paiement annulé")}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PayInvoiceDialog;
