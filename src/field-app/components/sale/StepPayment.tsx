/**
 * Step 6 — Payment Options
 * Option A: Send real payment link via Stripe Checkout + email
 * Option B: Take real card payment via Stripe Elements inline
 */
import { useState, useEffect, useMemo } from "react";
import { Link2, CreditCard, Send, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { getStripePublishableKey } from "@/config/stripe";
import type { FieldSalePayment, FieldSaleCustomer } from "@/field-app/lib/fieldSaleTypes";
import { toast } from "sonner";

interface Props {
  payment: FieldSalePayment;
  customer: FieldSaleCustomer;
  totalAmount: number;
  leadId?: string;
  onChange: (p: FieldSalePayment) => void;
  onNext: () => void;
  onBack: () => void;
}

/* ─── Card Form (inner Stripe Elements) ─── */
function CardForm({ amount, onSuccess }: { amount: number; onSuccess: (piId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || "Erreur de validation");
      setProcessing(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Paiement refusé");
      setProcessing(false);
      return;
    }

    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "requires_capture")) {
      onSuccess(paymentIntent.id);
    } else {
      setError("Le paiement n'a pas été complété");
    }
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#22C55E] text-white text-sm font-bold hover:bg-[#16A34A] disabled:opacity-50 transition-colors"
      >
        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {processing ? "Traitement…" : `Payer ${amount.toFixed(2)} $`}
      </button>
    </form>
  );
}

export default function StepPayment({ payment, customer, totalAmount, leadId, onChange, onNext, onBack }: Props) {
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(payment.status === "sent");

  // Card payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);

  const stripePromise = useMemo(() => {
    try {
      return loadStripe(getStripePublishableKey());
    } catch {
      return null;
    }
  }, []);

  // ── Option A: Send real payment link ──
  const handleSendLink = async () => {
    if (!customer.email.trim()) {
      toast.error("Le client doit avoir un courriel pour recevoir le lien de paiement.");
      return;
    }
    setSendingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke("field-sale-payment", {
        body: {
          action: "create_payment_link",
          amount: totalAmount,
          customer_email: customer.email,
          customer_name: `${customer.first_name} ${customer.last_name}`,
          description: `Nivra — Commande terrain`,
          lead_id: leadId || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      onChange({ ...payment, method: "send_link", status: "sent", linkSentTo: customer.email });
      setLinkSent(true);
      toast.success(`Lien de paiement envoyé à ${customer.email}`);
    } catch (err) {
      console.error("[StepPayment] send link error:", err);
      toast.error("Erreur lors de l'envoi du lien de paiement");
    } finally {
      setSendingLink(false);
    }
  };

  // ── Option B: Create PaymentIntent for inline card ──
  const initCardPayment = async () => {
    if (clientSecret) return; // already initialized
    setLoadingIntent(true);
    setIntentError(null);
    try {
      const { data, error } = await supabase.functions.invoke("field-sale-payment", {
        body: {
          action: "create_payment_intent",
          amount: totalAmount,
          customer_email: customer.email || undefined,
          description: `Nivra — Paiement terrain`,
          lead_id: leadId || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.client_secret) throw new Error("Aucun client_secret retourné");

      setClientSecret(data.client_secret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur Stripe";
      setIntentError(msg);
      console.error("[StepPayment] card init error:", err);
    } finally {
      setLoadingIntent(false);
    }
  };

  const handleCardSuccess = (piId: string) => {
    onChange({ ...payment, method: "card_present", status: "completed", linkSentTo: null });
    toast.success("Paiement traité avec succès !");
  };

  // Auto-init card intent when card_present is selected
  useEffect(() => {
    if (payment.method === "card_present" && payment.status !== "completed") {
      initCardPayment();
    }
  }, [payment.method]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#000000]">Paiement</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Montant total : <span className="font-bold text-[#000000]">{totalAmount.toFixed(2)} $</span>
        </p>
      </div>

      {/* Option A: Send link */}
      <div className={cn(
        "rounded-xl border-2 p-5 transition-all",
        payment.method === "send_link" ? "border-[#22C55E] bg-[#F0FDF4]" : "border-[#E5E7EB] bg-white"
      )}>
        <button
          type="button"
          onClick={() => onChange({ ...payment, method: "send_link", status: "pending" })}
          className="w-full text-left"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center",
              payment.method === "send_link" ? "bg-[#DCFCE7]" : "bg-[#F3F4F6]"
            )}>
              <Link2 className={cn("h-5 w-5", payment.method === "send_link" ? "text-[#16A34A]" : "text-[#6B7280]")} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#000000]">Envoyer un lien de paiement</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Le client paiera en ligne via un lien sécurisé Stripe</p>
            </div>
          </div>
        </button>

        {payment.method === "send_link" && (
          <div className="mt-4 pt-4 border-t border-[#BBF7D0] space-y-3">
            <div>
              <label className="text-xs font-medium text-[#374151] mb-1 block">Envoyer le lien à</label>
              <div className="flex items-center gap-2 text-sm text-[#000000] bg-white border border-[#E5E7EB] rounded-lg px-3 py-2.5">
                <Mail className="h-4 w-4 text-[#6B7280]" />
                <span>{customer.email || "Aucun courriel — requis"}</span>
              </div>
            </div>

            {linkSent ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#DCFCE7] text-sm text-[#16A34A] font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Lien envoyé à {payment.linkSentTo}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSendLink}
                disabled={sendingLink || !customer.email.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#2563EB] disabled:opacity-40 transition-colors"
              >
                {sendingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendingLink ? "Envoi en cours…" : "Envoyer le lien de paiement"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Option B: Card present */}
      <div className={cn(
        "rounded-xl border-2 p-5 transition-all",
        payment.method === "card_present" ? "border-[#22C55E] bg-[#F0FDF4]" : "border-[#E5E7EB] bg-white"
      )}>
        <button
          type="button"
          onClick={() => onChange({ ...payment, method: "card_present", status: "pending" })}
          className="w-full text-left"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center",
              payment.method === "card_present" ? "bg-[#DCFCE7]" : "bg-[#F3F4F6]"
            )}>
              <CreditCard className={cn("h-5 w-5", payment.method === "card_present" ? "text-[#16A34A]" : "text-[#6B7280]")} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#000000]">Prendre le paiement maintenant</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Le client paie par carte sur place via Stripe</p>
            </div>
          </div>
        </button>

        {payment.method === "card_present" && (
          <div className="mt-4 pt-4 border-t border-[#BBF7D0] space-y-3">
            {payment.status === "completed" ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#DCFCE7] text-sm text-[#16A34A] font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Paiement complété — {totalAmount.toFixed(2)} $
              </div>
            ) : loadingIntent ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" />
                <span className="text-sm text-[#6B7280]">Chargement du formulaire de paiement…</span>
              </div>
            ) : intentError ? (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {intentError}
                <button
                  type="button"
                  onClick={() => { setClientSecret(null); setIntentError(null); initCardPayment(); }}
                  className="ml-2 underline text-red-800"
                >
                  Réessayer
                </button>
              </div>
            ) : clientSecret && stripePromise ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: { colorPrimary: "#22C55E", borderRadius: "8px" },
                  },
                  locale: "fr",
                }}
              >
                <CardForm amount={totalAmount} onSuccess={handleCardSuccess} />
              </Elements>
            ) : (
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 text-xs text-[#92400E]">
                ⚠️ Initialisation du paiement en cours…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">
          ← Retour
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={payment.status === "pending"}
          className="flex-1 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continuer →
        </button>
      </div>
    </div>
  );
}
