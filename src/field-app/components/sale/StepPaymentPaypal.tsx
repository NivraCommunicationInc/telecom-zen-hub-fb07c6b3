/**
 * Step 5 — Paiement (PayPal + manual card)
 *
 * FIX 1: Order is NEVER created here. We save the quote, then ask the
 * backend to generate a PayPal link tied to a field_payment_intent. The
 * Core order/invoice/commission are materialized only when the PayPal
 * webhook confirms payment.
 *
 * FIX 2: Adds a third option — "Prise en charge manuelle — Carte de crédit".
 * Card data is sent to the field-card-intent edge function which encrypts
 * the card number (AES-256-GCM) and bcrypt-hashes the CVV. Only Core
 * admins can read the encrypted record.
 */
import { useState } from "react";
import { ArrowLeft, ArrowRight, CreditCard, Mail, Loader2, CheckCircle2, ExternalLink, Copy, Check, Lock } from "lucide-react";
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
  onSubmitCard?: (card: { number: string; name: string; expiry: string; cvv: string }) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
  submitMessage?: string;
}

const formatCAD = (n: number) =>
  n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

const formatCardNumber = (v: string) =>
  v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();

const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
};

export default function StepPaymentPaypal({
  payment, customer, totalAmount, onChange, onSubmit, onSubmitCard, onBack, isSubmitting, submitMessage,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });

  const setMethod = (method: FieldPaymentMethod) => {
    onChange({
      ...payment, method, status: "pending", linkSentTo: null,
      paypalApprovalUrl: null, paypalOrderId: null, fieldOrderId: null, invoiceId: null, coreOrderId: null,
    });
    setQrDataUrl(null);
  };

  const generateQR = async (url: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 280, margin: 1, color: { dark: "#7c3aed", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
    } catch (err) { console.error("[QR] failed to generate", err); }
  };

  if (payment.method === "paypal_onsite" && payment.paypalApprovalUrl && !qrDataUrl) {
    generateQR(payment.paypalApprovalUrl);
  }

  const isCompleted = payment.status === "completed";
  const isLinkReady = !!payment.paypalApprovalUrl;
  const isSent = payment.method === "paypal_email" && payment.status === "sent";
  const isCardSent = (payment.method as string) === "card_manual" && payment.status === "sent";

  const handleCardSubmit = async () => {
    if (!onSubmitCard) return;
    if (card.number.replace(/\s/g, "").length < 13) { toast.error("Numéro de carte invalide"); return; }
    if (!card.name.trim()) { toast.error("Nom sur la carte requis"); return; }
    if (!/^\d{2}\/\d{2}$/.test(card.expiry)) { toast.error("Format MM/YY requis"); return; }
    if (!/^\d{3,4}$/.test(card.cvv)) { toast.error("CVV invalide"); return; }
    await onSubmitCard({
      number: card.number.replace(/\s/g, ""), name: card.name.trim(),
      expiry: card.expiry, cvv: card.cvv,
    });
  };

  return (
    <div className="space-y-5 field-page-enter">
      <div>
        <h2 className="text-2xl font-bold text-white">Paiement</h2>
        <p className="text-sm text-[hsl(var(--field-text-muted))] mt-1">
          {formatCAD(totalAmount)} — Sélectionnez comment le client paie.
        </p>
      </div>

      <div className="grid gap-3">
        {[
          { id: "paypal_onsite" as const, icon: CreditCard, title: "Payer sur place", desc: "Génère un lien + QR. Le client paie sur votre appareil." },
          { id: "paypal_email" as const, icon: Mail, title: "Envoyer par courriel", desc: `Envoie un lien PayPal à ${customer.email || "—"}` },
          { id: "card_manual" as any, icon: Lock, title: "Prise en charge manuelle — Carte de crédit", desc: "Saisie sécurisée. Traitement par un administrateur Nivra Core." },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id as FieldPaymentMethod)}
            disabled={isSubmitting || isLinkReady || isCardSent}
            className={cn(
              "field-card-interactive text-left rounded-2xl p-4 border transition-all flex items-center gap-4",
              payment.method === m.id
                ? "border-[hsl(var(--field-accent))] bg-[hsl(var(--field-accent)/0.12)] field-glow"
                : "border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))]",
              (isSubmitting || isLinkReady || isCardSent) && "opacity-60 cursor-not-allowed",
            )}
          >
            <div className="w-12 h-12 rounded-xl bg-[hsl(var(--field-accent)/0.15)] flex items-center justify-center">
              <m.icon className="h-6 w-6 text-[hsl(var(--field-accent-glow))]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">{m.title}</h3>
              <p className="text-xs text-[hsl(var(--field-text-muted))]">{m.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* PAYPAL submit */}
      {(payment.method === "paypal_onsite" || payment.method === "paypal_email") && !isLinkReady && !isCompleted && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || (payment.method === "paypal_email" && !customer.email)}
          className="w-full h-14 rounded-2xl field-gradient-accent text-white font-bold text-base field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <><Loader2 className="h-5 w-5 animate-spin" />{submitMessage || "Génération du lien…"}</>
          ) : payment.method === "paypal_onsite" ? (
            <>Générer le lien de paiement <ArrowRight className="h-4 w-4" /></>
          ) : (
            <>Envoyer le lien au client <Mail className="h-4 w-4" /></>
          )}
        </button>
      )}

      {/* CARD form */}
      {(payment.method as string) === "card_manual" && !isCardSent && !isCompleted && (
        <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[hsl(var(--field-accent-glow))] text-sm">
            <Lock className="h-4 w-4" /> Données chiffrées avant transmission
          </div>
          <div>
            <label className="block text-xs text-[hsl(var(--field-text-muted))] mb-1">Numéro de carte</label>
            <input
              inputMode="numeric" autoComplete="cc-number"
              placeholder="1234 5678 9012 3456"
              value={card.number}
              onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
              className="w-full h-12 rounded-xl bg-[hsl(var(--field-bg))] border border-[hsl(var(--field-border-subtle))] px-4 text-white tracking-widest"
            />
          </div>
          <div>
            <label className="block text-xs text-[hsl(var(--field-text-muted))] mb-1">Nom sur la carte</label>
            <input
              autoComplete="cc-name"
              value={card.name}
              onChange={(e) => setCard({ ...card, name: e.target.value })}
              className="w-full h-12 rounded-xl bg-[hsl(var(--field-bg))] border border-[hsl(var(--field-border-subtle))] px-4 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[hsl(var(--field-text-muted))] mb-1">Expiration (MM/YY)</label>
              <input
                inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY"
                value={card.expiry}
                onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                className="w-full h-12 rounded-xl bg-[hsl(var(--field-bg))] border border-[hsl(var(--field-border-subtle))] px-4 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[hsl(var(--field-text-muted))] mb-1">CVV</label>
              <input
                inputMode="numeric" autoComplete="cc-csc" type="password" maxLength={4}
                value={card.cvv}
                onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                className="w-full h-12 rounded-xl bg-[hsl(var(--field-bg))] border border-[hsl(var(--field-border-subtle))] px-4 text-white tracking-widest"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCardSubmit}
            disabled={isSubmitting}
            className="w-full h-14 rounded-2xl field-gradient-accent text-white font-bold field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting
              ? <><Loader2 className="h-5 w-5 animate-spin" />{submitMessage || "Enregistrement…"}</>
              : <>Enregistrer et placer la commande <ArrowRight className="h-4 w-4" /></>}
          </button>
          <p className="text-xs text-[hsl(var(--field-text-dim))] text-center">
            La carte est chiffrée (AES-256). Seul un administrateur Nivra Core peut traiter ce paiement. Les 4 derniers chiffres seuls sont visibles.
          </p>
        </div>
      )}

      {/* PayPal on-site result */}
      {payment.method === "paypal_onsite" && isLinkReady && (
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] field-gradient-purple p-5 space-y-4">
          <div className="flex items-center gap-2 text-[hsl(var(--field-accent-glow))]">
            <CheckCircle2 className="h-5 w-5" /><span className="font-semibold">Lien PayPal généré</span>
          </div>
          {qrDataUrl && (
            <div className="bg-white rounded-xl p-4 mx-auto w-fit">
              <img src={qrDataUrl} alt="QR PayPal" className="block" />
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--field-text-dim))]">Lien direct</p>
            <div className="flex items-center gap-2">
              <input readOnly value={payment.paypalApprovalUrl || ""} className="flex-1 text-xs bg-[hsl(var(--field-bg))] border border-[hsl(var(--field-border-subtle))] rounded-lg px-3 py-2 text-white truncate" />
              <button type="button" onClick={() => { navigator.clipboard.writeText(payment.paypalApprovalUrl || ""); setCopied(true); toast.success("Lien copié"); setTimeout(() => setCopied(false), 1500); }} className="p-2 rounded-lg bg-[hsl(var(--field-accent)/0.2)] text-[hsl(var(--field-accent-glow))]">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
              <a href={payment.paypalApprovalUrl || "#"} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[hsl(var(--field-accent)/0.2)] text-[hsl(var(--field-accent-glow))]">
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
          <p className="text-xs text-[hsl(var(--field-text-muted))] text-center">
            En attente du paiement client. La commande sera créée automatiquement après confirmation.
          </p>
        </div>
      )}

      {payment.method === "paypal_email" && isSent && (
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] field-gradient-purple p-5 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-[hsl(var(--field-accent-glow))] mx-auto" />
          <p className="font-semibold text-white">Lien envoyé ✓</p>
          <p className="text-sm text-[hsl(var(--field-text-muted))]">
            Le client a reçu le lien PayPal à <span className="text-white">{payment.linkSentTo}</span>. La commande sera créée après paiement.
          </p>
        </div>
      )}

      {isCardSent && (
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] field-gradient-purple p-5 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-[hsl(var(--field-accent-glow))] mx-auto" />
          <p className="font-semibold text-white">Carte enregistrée ✓</p>
          <p className="text-sm text-[hsl(var(--field-text-muted))]">
            Le paiement sera traité par un administrateur Nivra Core dans un délai de 48 h.
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
        <button type="button" onClick={onBack} disabled={isSubmitting} className="flex-1 h-12 rounded-xl border border-[hsl(var(--field-border-subtle))] text-white font-medium hover:bg-[hsl(var(--field-card-hover))] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
      </div>
    </div>
  );
}
