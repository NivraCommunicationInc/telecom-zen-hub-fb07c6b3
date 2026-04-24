/**
 * Step 5 — Paiement (PayPal only)
 *
 * Two options:
 *  A) paypal_onsite — generate PayPal link + QR, client pays on the agent's device
 *  B) paypal_email  — email a PayPal link to the client (Violet Bold Nivra template)
 *
 * In both cases the order is created BEFORE generating the link so the
 * invoice/order ID is fixed and trackable in real-time.
 */
import { useState } from "react";
import { ArrowLeft, ArrowRight, CreditCard, Mail, Loader2, CheckCircle2, ExternalLink, Copy, Check } from "lucide-react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { FieldPaymentMethod, FieldSalePayment, FieldSaleCustomer } from "@/field-app/lib/fieldSaleTypes";

interface Props {
  payment: FieldSalePayment;
  customer: FieldSaleCustomer;
  totalAmount: number;
  onChange: (payment: FieldSalePayment) => void;
  onSubmit: () => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
  submitMessage?: string;
}

const formatCAD = (n: number) =>
  n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

export default function StepPaymentPaypal({
  payment,
  customer,
  totalAmount,
  onChange,
  onSubmit,
  onBack,
  isSubmitting,
  submitMessage,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const setMethod = (method: FieldPaymentMethod) => {
    onChange({
      ...payment,
      method,
      status: "pending",
      linkSentTo: null,
      paypalApprovalUrl: null,
      paypalOrderId: null,
      fieldOrderId: null,
      invoiceId: null,
      coreOrderId: null,
    });
    setQrDataUrl(null);
  };

  const generateQR = async (url: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 280,
        margin: 1,
        color: { dark: "#7c3aed", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error("[QR] failed to generate", err);
    }
  };

  const handleSubmit = async () => {
    await onSubmit();
    // Once submitted, FieldNewSale will refresh `payment.paypalApprovalUrl`
    // via state — the QR is generated below in render when URL appears.
  };

  // Auto-generate QR when approval URL appears (on-site mode)
  if (payment.method === "paypal_onsite" && payment.paypalApprovalUrl && !qrDataUrl) {
    generateQR(payment.paypalApprovalUrl);
  }

  const isCompleted = payment.status === "completed";
  const isLinkReady = !!payment.paypalApprovalUrl;
  const isSent = payment.method === "paypal_email" && payment.status === "sent";

  return (
    <div className="space-y-5 field-page-enter">
      <div>
        <h2 className="text-2xl font-bold text-white">Paiement</h2>
        <p className="text-sm text-[hsl(var(--field-text-muted))] mt-1">
          {formatCAD(totalAmount)} — Sélectionnez comment le client paie.
        </p>
      </div>

      {/* Method selector */}
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setMethod("paypal_onsite")}
          disabled={isSubmitting || isLinkReady}
          className={cn(
            "field-card-interactive text-left rounded-2xl p-4 border transition-all flex items-center gap-4",
            payment.method === "paypal_onsite"
              ? "border-[hsl(var(--field-accent))] bg-[hsl(var(--field-accent)/0.12)] field-glow"
              : "border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))]",
            (isSubmitting || isLinkReady) && "opacity-60 cursor-not-allowed"
          )}
        >
          <div className="w-12 h-12 rounded-xl bg-[hsl(var(--field-accent)/0.15)] flex items-center justify-center">
            <CreditCard className="h-6 w-6 text-[hsl(var(--field-accent-glow))]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">Payer sur place</h3>
            <p className="text-xs text-[hsl(var(--field-text-muted))]">
              Génère un lien + QR. Le client paie sur votre appareil.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMethod("paypal_email")}
          disabled={isSubmitting || isLinkReady}
          className={cn(
            "field-card-interactive text-left rounded-2xl p-4 border transition-all flex items-center gap-4",
            payment.method === "paypal_email"
              ? "border-[hsl(var(--field-accent))] bg-[hsl(var(--field-accent)/0.12)] field-glow"
              : "border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))]",
            (isSubmitting || isLinkReady) && "opacity-60 cursor-not-allowed"
          )}
        >
          <div className="w-12 h-12 rounded-xl bg-[hsl(var(--field-accent)/0.15)] flex items-center justify-center">
            <Mail className="h-6 w-6 text-[hsl(var(--field-accent-glow))]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">Envoyer par courriel</h3>
            <p className="text-xs text-[hsl(var(--field-text-muted))]">
              Envoie un lien PayPal à <span className="text-white">{customer.email || "—"}</span>
            </p>
          </div>
        </button>
      </div>

      {/* Submit / generate area */}
      {!isLinkReady && !isCompleted && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || (payment.method === "paypal_email" && !customer.email)}
          className="w-full h-14 rounded-2xl field-gradient-accent text-white font-bold text-base field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {submitMessage || "Création de la commande…"}
            </>
          ) : payment.method === "paypal_onsite" ? (
            <>Générer le lien de paiement <ArrowRight className="h-4 w-4" /></>
          ) : (
            <>Envoyer le lien au client <Mail className="h-4 w-4" /></>
          )}
        </button>
      )}

      {/* On-site result: link + QR */}
      {payment.method === "paypal_onsite" && isLinkReady && (
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] field-gradient-purple p-5 space-y-4">
          <div className="flex items-center gap-2 text-[hsl(var(--field-accent-glow))]">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Lien PayPal généré</span>
          </div>

          {qrDataUrl && (
            <div className="bg-white rounded-xl p-4 mx-auto w-fit">
              <img src={qrDataUrl} alt="QR PayPal" className="block" />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--field-text-dim))]">Lien direct</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={payment.paypalApprovalUrl || ""}
                className="flex-1 text-xs bg-[hsl(var(--field-bg))] border border-[hsl(var(--field-border-subtle))] rounded-lg px-3 py-2 text-white truncate"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(payment.paypalApprovalUrl || "");
                  setCopied(true);
                  toast.success("Lien copié");
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="p-2 rounded-lg bg-[hsl(var(--field-accent)/0.2)] text-[hsl(var(--field-accent-glow))] hover:bg-[hsl(var(--field-accent)/0.3)] transition-colors"
                aria-label="Copier"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
              <a
                href={payment.paypalApprovalUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-[hsl(var(--field-accent)/0.2)] text-[hsl(var(--field-accent-glow))] hover:bg-[hsl(var(--field-accent)/0.3)] transition-colors"
                aria-label="Ouvrir"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          <p className="text-xs text-[hsl(var(--field-text-muted))] text-center">
            En attente du paiement client. Le statut se met à jour automatiquement.
          </p>
        </div>
      )}

      {/* Email result */}
      {payment.method === "paypal_email" && isSent && (
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] field-gradient-purple p-5 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-[hsl(var(--field-accent-glow))] mx-auto" />
          <p className="font-semibold text-white">Lien envoyé ✓</p>
          <p className="text-sm text-[hsl(var(--field-text-muted))]">
            Le client a reçu le lien PayPal à <span className="text-white">{payment.linkSentTo}</span>.
            Valable 24 heures.
          </p>
        </div>
      )}

      {isCompleted && (
        <div className="rounded-2xl border border-[hsl(var(--field-success)/0.5)] bg-[hsl(var(--field-success)/0.1)] p-5 text-center">
          <CheckCircle2 className="h-10 w-10 text-[hsl(var(--field-success))] mx-auto mb-2" />
          <p className="font-bold text-white text-lg">Paiement confirmé</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 h-12 rounded-xl border border-[hsl(var(--field-border-subtle))] text-white font-medium hover:bg-[hsl(var(--field-card-hover))] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
      </div>
    </div>
  );
}
