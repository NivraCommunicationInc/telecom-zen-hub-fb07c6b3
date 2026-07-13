/**
 * Step 5 — Paiement (Square)
 *
 * Three methods:
 *   square_inline — Square card widget on agent device (immediate)
 *   square_onsite — QR code to /payer/:intentId (client pays on own device)
 *   square_email  — Email link to /payer/:intentId
 *
 * After QR/email, a 5-minute polling screen waits for intent status=completed.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, CreditCard, Mail, Loader2, CheckCircle2, ExternalLink, Copy, Check, RefreshCw, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { FieldPaymentMethod, FieldSalePayment, FieldSaleCustomer } from "@/field-app/lib/fieldSaleTypes";

const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";
const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface Props {
  payment: FieldSalePayment;
  customer: FieldSaleCustomer;
  totalAmount: number;
  onChange: (payment: FieldSalePayment) => void;
  onSubmit: () => Promise<void>;
  onSquareInlineInit?: () => Promise<void>;
  onSquareInlineSuccess?: (paymentId: string) => void;
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

const TIMER_SECONDS = 5 * 60;

export default function StepPaymentPaypal({
  payment, customer, totalAmount, onChange, onSubmit, onSquareInlineInit, onSquareInlineSuccess,
  onBack, isSubmitting, submitMessage,
  onResendEmail, onChangeMethod,
  onCancelTransaction, onHoldTransaction, onConvertToQuote,
}: Props) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Square inline widget state
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);
  const [sqLoading, setSqLoading] = useState(true);
  const [sqPaying, setSqPaying] = useState(false);

  // 5-min waiting timer + polling
  const [secondsLeft, setSecondsLeft] = useState<number>(TIMER_SECONDS);
  const [waiting, setWaiting] = useState(false);
  const [expired, setExpired] = useState(false);
  const timerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const intentId = payment.fieldOrderId;

  const isCompleted = payment.status === "completed";
  const isLinkReady = !!payment.paypalApprovalUrl;
  const selectedMethod = payment.method as string | undefined;
  const needsMethodSelection = !selectedMethod;
  const isSent = selectedMethod === "square_email" && payment.status === "sent";
  const isSquareInlineReady = (payment.method as string) === "square_inline" && !!payment.fieldOrderId;

  const stopAll = useCallback(() => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Initialize Square widget when inline mode becomes ready
  useEffect(() => {
    if (!isSquareInlineReady || isCompleted) return;
    let destroyed = false;
    const init = async () => {
      try {
        if (!(window as any).Square) {
          await new Promise<void>((resolve, reject) => {
            if (document.querySelector('script[src*="web.squarecdn.com"]')) {
              const poll = setInterval(() => {
                if ((window as any).Square) { clearInterval(poll); resolve(); }
              }, 100);
              return;
            }
            const s = document.createElement("script");
            s.src = "https://web.squarecdn.com/v1/square.js";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Impossible de charger Square"));
            document.head.appendChild(s);
          });
        }
        if (destroyed) return;
        const payments = (window as any).Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
        const card = await payments.card();
        if (!containerRef.current || destroyed) { card.destroy(); return; }
        await card.attach(containerRef.current);
        if (destroyed) { card.destroy(); return; }
        cardRef.current = card;
        setSqLoading(false);
      } catch (e: any) {
        if (!destroyed) {
          toast.error("Erreur chargement Square : " + (e?.message || String(e)));
          setSqLoading(false);
        }
      }
    };
    init();
    return () => {
      destroyed = true;
      cardRef.current?.destroy?.();
      cardRef.current = null;
      setSqLoading(true);
    };
  }, [isSquareInlineReady, isCompleted]);

  const handleSquarePay = async () => {
    if (!cardRef.current) { toast.error("Formulaire non prêt."); return; }
    setSqPaying(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        toast.error(result.errors?.[0]?.message || "Informations de carte invalides");
        return;
      }
      const res = await fetch(`${BACKEND_URL}/functions/v1/square-charge-invoice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${BACKEND_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          source_id: result.token,
          intent_id: intentId,
          customer_email: customer.email || null,
        }),
      });
      const data = await res.json();
      if (!data?.ok) { toast.error(data?.error || "Paiement refusé"); return; }
      onChange({ ...payment, status: "completed" });
      onSquareInlineSuccess?.(data.payment_id);
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setSqPaying(false);
    }
  };

  // Start waiting + polling when link is ready or email is sent
  useEffect(() => {
    if (!isLinkReady && !isSent) return;
    if (isCompleted) { stopAll(); return; }
    setWaiting(true); setExpired(false); setSecondsLeft(TIMER_SECONDS);
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
          if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
          setExpired(true); return 0;
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
      if ((data as any)?.status === "completed") {
        stopAll(); setWaiting(false);
        onChange({ ...payment, status: "completed" });
        toast.success("Paiement Square confirmé !");
      }
    };
    checkPayment();
    pollRef.current = window.setInterval(checkPayment, 10_000);
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLinkReady, isSent, intentId]);

  useEffect(() => () => stopAll(), [stopAll]);

  const setMethod = (method: FieldPaymentMethod) => {
    stopAll(); setWaiting(false); setExpired(false);
    onChange({
      ...payment,
      method,
      status: method === "square_email" && payment.status === "sent" ? "sent" : "pending",
      linkSentTo: method === "square_email" ? payment.linkSentTo : null,
    });
    setQrDataUrl(null);
  };

  const handleChangeMethod = () => {
    stopAll(); setWaiting(false); setExpired(false); setQrDataUrl(null);
    onChangeMethod?.();
  };

  const generateQR = async (url: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 280, margin: 1, color: { dark: "#7c3aed", light: "#ffffff" } });
      setQrDataUrl(dataUrl);
    } catch (err) { console.error("[QR] failed to generate", err); }
  };

  if ((payment.method as string) === "square_onsite" && payment.paypalApprovalUrl && !qrDataUrl) {
    generateQR(payment.paypalApprovalUrl);
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(1, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Client";

  return (
    <div className="space-y-5 field-page-enter">
      <div>
        <h2 className="text-2xl font-bold text-white">Paiement</h2>
        <p className="text-sm text-[hsl(var(--field-text-muted))] mt-1">
          {formatCAD(totalAmount)} — Sélectionnez comment le client paie.
        </p>
      </div>

      {/* Method selection */}
      {(!isLinkReady || needsMethodSelection) && !isCompleted && !isSquareInlineReady && (
        <div className="grid gap-3">
          {[
            { id: "square_inline" as const, icon: CreditCard, title: "💳 Carte — saisie directe", desc: "Le client saisit sa carte sur votre appareil. Paiement immédiat.", badge: "IMMÉDIAT" },
            { id: "square_onsite" as const, icon: QrCode, title: "QR Square — sur place", desc: "Génère un QR. Le client paie sur son propre appareil.", badge: null },
            { id: "square_email" as const, icon: Mail, title: "Envoyer par courriel", desc: `Envoie un lien de paiement à ${customer.email || "—"}`, badge: null },
          ].map((m) => (
            <button key={m.id} type="button" onClick={() => setMethod(m.id as FieldPaymentMethod)} disabled={isSubmitting}
              className={cn("field-card-interactive text-left rounded-2xl p-4 border transition-all flex items-center gap-4",
                payment.method === m.id ? "border-[hsl(var(--field-accent))] bg-[hsl(var(--field-accent)/0.12)] field-glow"
                  : "border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))]",
                isSubmitting && "opacity-60 cursor-not-allowed")}>
              <div className="w-12 h-12 rounded-xl bg-[hsl(var(--field-accent)/0.15)] flex items-center justify-center shrink-0">
                <m.icon className="h-6 w-6 text-[hsl(var(--field-accent-glow))]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white text-sm">{m.title}</h3>
                  {m.badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[hsl(var(--field-accent))] text-white shrink-0">{m.badge}</span>}
                </div>
                <p className="text-xs text-[hsl(var(--field-text-muted))] mt-0.5">{m.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* QR / Email — generate button */}
      {((selectedMethod === "square_onsite" && !isLinkReady) || (selectedMethod === "square_email" && (!isLinkReady || !isSent))) && !isCompleted && (
        <button type="button" onClick={onSubmit}
          disabled={isSubmitting || (selectedMethod === "square_email" && !customer.email)}
          className="w-full h-14 rounded-2xl field-gradient-accent text-white font-bold text-base field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? (
            <><Loader2 className="h-5 w-5 animate-spin" />{submitMessage || "Génération du lien…"}</>
          ) : selectedMethod === "square_onsite" ? (
            <>Générer le lien de paiement <CreditCard className="h-4 w-4" /></>
          ) : isLinkReady ? (
            <>Envoyer ce même lien au client <Mail className="h-4 w-4" /></>
          ) : (
            <>Envoyer le lien au client <Mail className="h-4 w-4" /></>
          )}
        </button>
      )}

      {/* Square inline — init button */}
      {(payment.method as string) === "square_inline" && !payment.fieldOrderId && !isCompleted && (
        <button type="button" onClick={onSquareInlineInit}
          disabled={isSubmitting}
          className="w-full h-14 rounded-2xl field-gradient-accent text-white font-bold text-base field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? (
            <><Loader2 className="h-5 w-5 animate-spin" />{submitMessage || "Préparation…"}</>
          ) : (
            <><CreditCard className="h-5 w-5" />Préparer le paiement par carte</>
          )}
        </button>
      )}

      {/* Square inline — card widget */}
      {isSquareInlineReady && !isCompleted && (
        <div className="rounded-2xl overflow-hidden border border-[hsl(var(--field-accent)/0.3)] bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[hsl(var(--field-accent))]" />
            <span className="text-sm font-semibold text-gray-800">Paiement sécurisé — Carte (Square)</span>
          </div>
          <div ref={containerRef} id="sq-field-card-container" className="min-h-[90px]" />
          {sqLoading && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Chargement du formulaire…
            </div>
          )}
          <button type="button" onClick={handleSquarePay} disabled={sqLoading || sqPaying}
            className="w-full h-14 rounded-2xl field-gradient-accent text-white font-bold field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {sqPaying
              ? <><Loader2 className="h-5 w-5 animate-spin" />Traitement…</>
              : <><CreditCard className="h-5 w-5" />Payer {formatCAD(totalAmount)} par carte</>}
          </button>
          <button type="button" onClick={handleChangeMethod}
            className="w-full text-xs text-[hsl(var(--field-text-dim))] hover:text-white pt-1 transition-colors">
            Changer de méthode
          </button>
        </div>
      )}

      {/* Square onsite — QR result */}
      {(payment.method as string) === "square_onsite" && isLinkReady && !expired && (
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] field-gradient-purple p-5 space-y-4">
          <div className="flex items-center gap-2 text-[hsl(var(--field-accent-glow))]">
            <CheckCircle2 className="h-5 w-5" /><span className="font-semibold">Lien de paiement Square généré</span>
          </div>
          {qrDataUrl && (
            <div className="bg-gray-800 rounded-xl p-4 mx-auto w-fit">
              <img src={qrDataUrl} alt="QR Square" className="block" />
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

      {/* WAITING SCREEN */}
      {waiting && !isCompleted && !expired && (
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] bg-[hsl(var(--field-card))] p-6 text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full border-4 border-[hsl(var(--field-accent)/0.2)] border-t-[hsl(var(--field-accent))] animate-spin" />
          <p className="text-white font-semibold text-lg">En attente du paiement client…</p>
          <p className="text-sm text-[hsl(var(--field-text-muted))]">
            <span className="text-white">{fullName}</span> · {formatCAD(totalAmount)}
          </p>
          <p className="text-3xl font-bold text-[hsl(var(--field-accent-glow))] tabular-nums">{mm}:{ss}</p>
          <button type="button" onClick={handleChangeMethod}
            className="w-full h-11 rounded-xl border border-[hsl(var(--field-border-subtle))] text-white font-medium hover:bg-[hsl(var(--field-card-hover))] transition-colors">
            Changer de méthode
          </button>
        </div>
      )}

      {/* EXPIRED */}
      {expired && !isCompleted && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-4">
          <p className="text-white font-semibold">Le délai de 5 minutes est écoulé.</p>
          <p className="text-sm text-[hsl(var(--field-text-muted))]">Choisissez une option pour continuer :</p>
          <div className="grid gap-2">
            <button type="button" onClick={async () => {
              if (payment.paypalApprovalUrl) { await generateQR(payment.paypalApprovalUrl); }
              setExpired(false); setSecondsLeft(TIMER_SECONDS); setWaiting(true);
              if (timerRef.current) window.clearInterval(timerRef.current);
              timerRef.current = window.setInterval(() => {
                setSecondsLeft((s) => { if (s <= 1) { if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; } setExpired(true); return 0; } return s - 1; });
              }, 1000);
            }} className="w-full h-12 rounded-xl field-gradient-accent text-white font-semibold flex items-center justify-center gap-2">
              <QrCode className="h-4 w-4" /> Payer sur place (QR Square)
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
            <button type="button" onClick={handleChangeMethod}
              className="w-full h-11 mt-1 rounded-xl text-[hsl(var(--field-text-muted))] text-sm hover:text-white">
              Changer de méthode
            </button>
          </div>
        </div>
      )}

      {/* Email sent confirmation */}
      {(payment.method as string) === "square_email" && isSent && !waiting && !expired && !isCompleted && (
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] field-gradient-purple p-5 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-[hsl(var(--field-accent-glow))] mx-auto" />
          <p className="font-semibold text-white">Lien envoyé ✓</p>
          <p className="text-sm text-[hsl(var(--field-text-muted))]">
            Le client a reçu le lien de paiement à <span className="text-white">{payment.linkSentTo}</span>.
          </p>
        </div>
      )}

      {isCompleted && (
        <div className="rounded-2xl border border-[hsl(var(--field-success)/0.5)] bg-[hsl(var(--field-success)/0.1)] p-5 text-center">
          <CheckCircle2 className="h-10 w-10 text-[hsl(var(--field-success))] mx-auto mb-2" />
          <p className="font-bold text-white text-lg">Paiement confirmé</p>
        </div>
      )}

      {/* CANCEL / HOLD / CONVERT */}
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
