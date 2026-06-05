/**
 * Step 5 — Paiement (PayPal + manual card)
 *
 * Payment-first flow: order is created only when PayPal webhook confirms.
 * After link is generated/sent, a 5-minute waiting screen polls
 * field_payment_intents until status='paid', then routes to success.
 * On expiry, the agent can resend the email, switch to QR (sur place),
 * or fall back to manual card. The "Changer de méthode" button is
 * always visible and stops the timer immediately.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, ArrowRight, CreditCard, Mail, Loader2, CheckCircle2, ExternalLink, Copy, Check, Lock, RefreshCw, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  onResendEmail?: () => Promise<void>;
  onChangeMethod?: () => void;
  onCancelTransaction?: (reason: string) => Promise<void>;
  onHoldTransaction?: () => Promise<void>;
  onConvertToQuote?: () => Promise<void>;
}

const formatCAD = (n: number) =>
  n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

const formatCardNumber = (v: string) =>
  v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();

const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
};

const TIMER_SECONDS = 5 * 60;

export default function StepPaymentPaypal({
  payment, customer, totalAmount, onChange, onSubmit, onSubmitCard, onBack, isSubmitting, submitMessage,
  onResendEmail, onChangeMethod,
  onCancelTransaction, onHoldTransaction, onConvertToQuote,
}: Props) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [showCardFallback, setShowCardFallback] = useState(false);

  // ── 5-min waiting timer + polling ──────────────────────────
  const [secondsLeft, setSecondsLeft] = useState<number>(TIMER_SECONDS);
  const [waiting, setWaiting] = useState(false);
  const [expired, setExpired] = useState(false);
  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const intentId = payment.fieldOrderId; // we store intent_id here in the new sale flow

  const isCompleted = payment.status === "completed";
  const isLinkReady = !!payment.paypalApprovalUrl;
  const isSent = payment.method === "paypal_email" && payment.status === "sent";
  const isCardSent = (payment.method as string) === "card_manual" && payment.status === "sent";

  const stopAll = useCallback(() => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Start waiting + polling whenever a link becomes ready (or email is sent)
  useEffect(() => {
    if (!isLinkReady && !isSent) return;
    if (isCompleted) { stopAll(); return; }

    setWaiting(true);
    setExpired(false);
    setSecondsLeft(TIMER_SECONDS);

    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
          if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
          setExpired(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    const checkPayment = async () => {
      if (!intentId) return;
      const { data } = await supabase
        .from("field_payment_intents")
        .select("status")
        .eq("id", intentId)
        .maybeSingle();
      if ((data as any)?.status === "paid") {
        stopAll();
        setWaiting(false);
        onChange({ ...payment, status: "completed" });
        toast.success("Paiement PayPal confirmé!");
      }
    };
    checkPayment();
    pollRef.current = window.setInterval(checkPayment, 10_000);

    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLinkReady, isSent, intentId]);

  useEffect(() => () => stopAll(), [stopAll]);

  const setMethod = (method: FieldPaymentMethod) => {
    stopAll();
    setWaiting(false); setExpired(false); setShowCardFallback(false);
    onChange({
      ...payment, method, status: "pending", linkSentTo: null,
      paypalApprovalUrl: null, paypalOrderId: null, fieldOrderId: null, invoiceId: null, coreOrderId: null,
    });
    setQrDataUrl(null);
  };

  const handleChangeMethod = () => {
    stopAll();
    setWaiting(false); setExpired(false); setShowCardFallback(false);
    setQrDataUrl(null);
    onChangeMethod?.();
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

  const mm = String(Math.floor(secondsLeft / 60)).padStart(1, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Client";

  // ── Manual card fallback after expiry ──────────────────────
  const renderCardFallback = () => (
    <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-5 space-y-3">
      <div className="flex items-center gap-2 text-[hsl(var(--field-accent-glow))] text-sm">
        <Lock className="h-4 w-4" /> Saisie manuelle — données chiffrées
      </div>
      <input inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456"
        value={card.number} onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
        className="w-full h-12 rounded-xl bg-[hsl(var(--field-bg))] border border-[hsl(var(--field-border-subtle))] px-4 text-white tracking-widest" />
      <input autoComplete="cc-name" placeholder="Nom sur la carte"
        value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })}
        className="w-full h-12 rounded-xl bg-[hsl(var(--field-bg))] border border-[hsl(var(--field-border-subtle))] px-4 text-white" />
      <div className="grid grid-cols-2 gap-3">
        <input inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY"
          value={card.expiry} onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
          className="w-full h-12 rounded-xl bg-[hsl(var(--field-bg))] border border-[hsl(var(--field-border-subtle))] px-4 text-white" />
        <input inputMode="numeric" autoComplete="cc-csc" type="password" maxLength={4} placeholder="CVV"
          value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          className="w-full h-12 rounded-xl bg-[hsl(var(--field-bg))] border border-[hsl(var(--field-border-subtle))] px-4 text-white tracking-widest" />
      </div>
      <button type="button" onClick={handleCardSubmit} disabled={isSubmitting}
        className="w-full h-14 rounded-2xl field-gradient-accent text-white font-bold field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50">
        {isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" />Enregistrement…</> : <>Enregistrer la carte <ArrowRight className="h-4 w-4" /></>}
      </button>
    </div>
  );

  return (
    <div className="space-y-5 field-page-enter">
      <div>
        <h2 className="text-2xl font-bold text-white">Paiement</h2>
        <p className="text-sm text-[hsl(var(--field-text-muted))] mt-1">
          {formatCAD(totalAmount)} — Sélectionnez comment le client paie.
        </p>
      </div>

      {!isLinkReady && !isCardSent && !isCompleted && (
        <div className="grid gap-3">
          {[
            { id: "paypal_onsite" as const, icon: CreditCard, title: "Payer sur place", desc: "Génère un lien + QR. Le client paie sur votre appareil." },
            { id: "paypal_email" as const, icon: Mail, title: "Envoyer par courriel", desc: `Envoie un lien PayPal à ${customer.email || "—"}` },
            { id: "card_manual" as any, icon: Lock, title: "Prise en charge manuelle — Carte de crédit", desc: "Saisie sécurisée. Traitement par un administrateur Nivra Core." },
          ].map((m) => (
            <button key={m.id} type="button" onClick={() => setMethod(m.id as FieldPaymentMethod)} disabled={isSubmitting}
              className={cn("field-card-interactive text-left rounded-2xl p-4 border transition-all flex items-center gap-4",
                payment.method === m.id ? "border-[hsl(var(--field-accent))] bg-[hsl(var(--field-accent)/0.12)] field-glow"
                  : "border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))]",
                isSubmitting && "opacity-60 cursor-not-allowed")}>
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
      )}

      {/* PAYPAL submit */}
      {(payment.method === "paypal_onsite" || payment.method === "paypal_email") && !isLinkReady && !isCompleted && (
        <button type="button" onClick={onSubmit}
          disabled={isSubmitting || (payment.method === "paypal_email" && !customer.email)}
          className="w-full h-14 rounded-2xl field-gradient-accent text-white font-bold text-base field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? (
            <><Loader2 className="h-5 w-5 animate-spin" />{submitMessage || "Génération du lien…"}</>
          ) : payment.method === "paypal_onsite" ? (
            <>Générer le lien de paiement <ArrowRight className="h-4 w-4" /></>
          ) : (
            <>Envoyer le lien au client <Mail className="h-4 w-4" /></>
          )}
        </button>
      )}

      {/* CARD form (initial) */}
      {(payment.method as string) === "card_manual" && !isCardSent && !isCompleted && renderCardFallback()}

      {/* PayPal on-site result (QR + link) */}
      {payment.method === "paypal_onsite" && isLinkReady && !expired && !showCardFallback && (
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] field-gradient-purple p-5 space-y-4">
          <div className="flex items-center gap-2 text-[hsl(var(--field-accent-glow))]">
            <CheckCircle2 className="h-5 w-5" /><span className="font-semibold">Lien PayPal généré</span>
          </div>
          {qrDataUrl && (
            <div className="bg-gray-800 rounded-xl p-4 mx-auto w-fit">
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
        </div>
      )}

      {/* WAITING SCREEN — 5 minute timer (visible while waiting and not expired) */}
      {waiting && !isCompleted && !expired && !showCardFallback && (
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] bg-[hsl(var(--field-card))] p-6 text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full border-4 border-[hsl(var(--field-accent)/0.2)] border-t-[hsl(var(--field-accent))] animate-spin" />
          <p className="text-white font-semibold text-lg">En attente du paiement client…</p>
          <p className="text-sm text-[hsl(var(--field-text-muted))]">
            <span className="text-white">{fullName}</span> · {formatCAD(totalAmount)}
          </p>
          <p className="text-3xl font-bold text-[hsl(var(--field-accent-glow))] tabular-nums">
            {mm}:{ss}
          </p>
          <button type="button" onClick={handleChangeMethod}
            className="w-full h-11 rounded-xl border border-[hsl(var(--field-border-subtle))] text-white font-medium hover:bg-[hsl(var(--field-card-hover))] transition-colors">
            Changer de méthode
          </button>
        </div>
      )}

      {/* EXPIRED — show 3 fallback options */}
      {expired && !isCompleted && !showCardFallback && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-4">
          <p className="text-white font-semibold">Le délai de 5 minutes est écoulé.</p>
          <p className="text-sm text-[hsl(var(--field-text-muted))]">Choisissez une option pour continuer :</p>
          <div className="grid gap-2">
            <button type="button" onClick={async () => {
              if (payment.paypalApprovalUrl) { await generateQR(payment.paypalApprovalUrl); }
              setExpired(false); setSecondsLeft(TIMER_SECONDS); setWaiting(true);
              // restart timer + polling via effect dependency change
              if (timerRef.current) window.clearInterval(timerRef.current);
              timerRef.current = window.setInterval(() => {
                setSecondsLeft((s) => { if (s <= 1) { if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; } setExpired(true); return 0; } return s - 1; });
              }, 1000);
            }} className="w-full h-12 rounded-xl field-gradient-accent text-white font-semibold flex items-center justify-center gap-2">
              <QrCode className="h-4 w-4" /> Payer sur place (PayPal QR)
            </button>
            <button type="button" disabled={!onResendEmail || !customer.email} onClick={async () => {
              await onResendEmail?.();
              setExpired(false); setSecondsLeft(TIMER_SECONDS); setWaiting(true);
              if (timerRef.current) window.clearInterval(timerRef.current);
              timerRef.current = window.setInterval(() => {
                setSecondsLeft((s) => { if (s <= 1) { if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; } setExpired(true); return 0; } return s - 1; });
              }, 1000);
            }} className="w-full h-12 rounded-xl border border-[hsl(var(--field-border-subtle))] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[hsl(var(--field-card-hover))] disabled:opacity-50">
              <RefreshCw className="h-4 w-4" /> Renvoyer le lien par courriel
            </button>
            <button type="button" onClick={() => setShowCardFallback(true)}
              className="w-full h-12 rounded-xl border border-[hsl(var(--field-border-subtle))] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[hsl(var(--field-card-hover))]">
              <CreditCard className="h-4 w-4" /> Saisir une carte manuellement
            </button>
            <button type="button" onClick={handleChangeMethod}
              className="w-full h-11 mt-1 rounded-xl text-[hsl(var(--field-text-muted))] text-sm hover:text-white">
              Changer de méthode
            </button>
          </div>
        </div>
      )}

      {showCardFallback && !isCardSent && !isCompleted && renderCardFallback()}

      {payment.method === "paypal_email" && isSent && !waiting && !expired && !isCompleted && (
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] field-gradient-purple p-5 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-[hsl(var(--field-accent-glow))] mx-auto" />
          <p className="font-semibold text-white">Lien envoyé ✓</p>
          <p className="text-sm text-[hsl(var(--field-text-muted))]">
            Le client a reçu le lien PayPal à <span className="text-white">{payment.linkSentTo}</span>.
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

      {/* CANCEL / HOLD / CONVERT — visible after link sent or email sent, before completion */}
      {(isLinkReady || isSent) && !isCompleted && (onCancelTransaction || onHoldTransaction || onConvertToQuote) && (
        <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-4 space-y-2">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--field-text-dim))] mb-2">Actions agent</p>
          {onCancelTransaction && (
            <button type="button" onClick={() => setShowCancelDialog(true)} disabled={isSubmitting}
              className="w-full h-11 rounded-xl border border-red-500/40 text-red-300 font-medium hover:bg-red-500/10 transition-colors text-sm disabled:opacity-50">
              ✕ Annuler la transaction
            </button>
          )}
          {onHoldTransaction && (
            <button type="button" onClick={() => onHoldTransaction()} disabled={isSubmitting}
              className="w-full h-11 rounded-xl border border-amber-500/40 text-amber-200 font-medium hover:bg-amber-500/10 transition-colors text-sm disabled:opacity-50">
              ⏸ Mettre en attente
            </button>
          )}
          {onConvertToQuote && (
            <button type="button" onClick={() => onConvertToQuote()} disabled={isSubmitting}
              className="w-full h-11 rounded-xl border border-[hsl(var(--field-accent)/0.4)] text-[hsl(var(--field-accent-glow))] font-medium hover:bg-[hsl(var(--field-accent)/0.1)] transition-colors text-sm disabled:opacity-50">
              📄 Convertir en soumission (7 jours)
            </button>
          )}
        </div>
      )}

      {showCancelDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowCancelDialog(false)}>
          <div className="bg-[hsl(var(--field-card))] border border-[hsl(var(--field-border-subtle))] rounded-2xl p-5 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white">Annuler la transaction</h3>
            <p className="text-sm text-[hsl(var(--field-text-muted))]">Indiquez le motif d'annulation. Le client sera informé par courriel.</p>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3}
              placeholder="Motif (ex: Client a changé d'avis)…"
              className="w-full rounded-xl bg-[hsl(var(--field-bg))] border border-[hsl(var(--field-border-subtle))] px-3 py-2 text-white text-sm" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCancelDialog(false)}
                className="flex-1 h-11 rounded-xl border border-[hsl(var(--field-border-subtle))] text-white font-medium text-sm">
                Retour
              </button>
              <button type="button" disabled={!cancelReason.trim() || isSubmitting}
                onClick={async () => { await onCancelTransaction?.(cancelReason.trim()); setShowCancelDialog(false); setCancelReason(""); }}
                className="flex-1 h-11 rounded-xl bg-red-500 text-white font-semibold text-sm disabled:opacity-50">
                Confirmer
              </button>
            </div>
          </div>
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
