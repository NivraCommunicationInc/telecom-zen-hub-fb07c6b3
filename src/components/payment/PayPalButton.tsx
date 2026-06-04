import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getInvokeErrorMessage } from "@/lib/functionsInvokeError";
import { notifyNivraCorePaid } from "@/lib/nivraCore";

interface CustomerInfo {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    admin_area_2?: string;
    admin_area_1?: string;
    postal_code?: string;
    country_code?: string;
  };
}

export interface PayPalPayerAddress {
  address_line_1?: string;
  address_line_2?: string;
  admin_area_2?: string;
  admin_area_1?: string;
  postal_code?: string;
  country_code?: string;
}

interface PayPalButtonProps {
  amount: number;
  invoiceId?: string;
  orderId?: string;
  description?: string;
  customer?: CustomerInfo;
  paymentNumber?: string;
  onSuccess?: (captureId: string, payerAddress?: PayPalPayerAddress | null) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  className?: string;
}

declare global {
  interface Window { paypal?: any; }
}

const PAYPAL_SDK_ID = "nivra-paypal-sdk";

async function createOrder(amount: number, invoiceId: string | undefined, orderId: string | undefined, description: string, customer: CustomerInfo | undefined) {
  const { data, error } = await supabase.functions.invoke("paypal-create-order", {
    body: { amount, invoice_id: invoiceId, order_id: orderId, description, customer },
  });
  if (error) throw error;
  if (!data?.paypal_order_id) throw new Error("Aucun ID PayPal retourné");
  return data.paypal_order_id as string;
}

async function captureOrder(paypalOrderId: string, invoiceId: string | undefined, orderId: string | undefined) {
  const { data, error } = await supabase.functions.invoke("paypal-capture-order", {
    body: { paypal_order_id: paypalOrderId, invoice_id: invoiceId, order_id: orderId },
  });
  if (error) throw error;
  if (!data?.capture_id) throw new Error("Capture ID manquant");
  return { captureId: data.capture_id as string, payerAddress: data.payer_address ?? null };
}

// ── Inline card form (CardFields API) ──────────────────────────────────────
const InlineCardForm = ({ amount, invoiceId, orderId, description, customer, paymentNumber, onSuccess, disabled }: PayPalButtonProps) => {
  const [name, setName]           = useState([customer?.first_name, customer?.last_name].filter(Boolean).join(" "));
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady]           = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const fieldsRef   = useRef<any>(null);
  const capturedRef = useRef(false);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = `${orderId || invoiceId || "cf"}`;

  const billingAddress = customer?.address?.address_line_1 || "";
  const billingCity    = customer?.address?.admin_area_2   || "";
  const billingPostal  = (customer?.address?.postal_code   || "").replace(/\s/g, "").toUpperCase();
  const normalizedAmt  = useMemo(() => Math.round(amount * 100) / 100, [amount]);

  useEffect(() => {
    if (!window.paypal?.CardFields) return;
    try {
      const cf = window.paypal.CardFields({
        createOrder: async () => {
          try { return await createOrder(normalizedAmt, invoiceId, orderId, description || "Paiement Nivra", customer); }
          catch (e: any) { const m = await getInvokeErrorMessage(e); setError(m); throw e; }
        },
        onApprove: async (d: { orderID: string }) => {
          if (capturedRef.current) return;
          capturedRef.current = true;
          if (timerRef.current) clearTimeout(timerRef.current);
          setSubmitting(true);
          try {
            const { captureId, payerAddress } = await captureOrder(d.orderID, invoiceId, orderId);
            toast.success("Paiement réussi !");
            if (paymentNumber) notifyNivraCorePaid({ paymentNumber, paypalOrderId: d.orderID, paypalCaptureId: captureId });
            onSuccess?.(captureId, payerAddress);
          } catch (e: any) {
            const m = await getInvokeErrorMessage(e);
            setError(m);
            capturedRef.current = false;
            setSubmitting(false);
          }
        },
        onError: async (e: any) => {
          if (timerRef.current) clearTimeout(timerRef.current);
          const m = await getInvokeErrorMessage(e).catch(() => "Erreur de paiement. Veuillez réessayer.");
          setError(m);
          setSubmitting(false);
        },
        style: {
          input: { "font-size": "15px", "font-family": "Inter, system-ui, sans-serif", color: "#111827", padding: "0 12px" },
          ".invalid": { color: "#dc2626" },
          ":focus": { color: "#111827" },
          "::placeholder": { color: "#9ca3af" },
        },
      });
      if (cf.isEligible()) {
        fieldsRef.current = cf;
        cf.NumberField({ placeholder: "1234 5678 9012 3456" }).render(`#cf-num-${uid}`);
        cf.ExpiryField({ placeholder: "MM/AA" }).render(`#cf-exp-${uid}`);
        cf.CVVField({ placeholder: "123" }).render(`#cf-cvv-${uid}`);
        setReady(true);
      } else {
        setError("Paiement par carte non disponible. Utilisez les boutons ci-dessous.");
      }
    } catch (e) { console.error("[CardFields]", e); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !fieldsRef.current || capturedRef.current) return;
    if (!name.trim())     { setError("Entrez le nom sur la carte"); return; }
    if (!billingPostal)   { setError("Adresse de service manquante"); return; }
    if (normalizedAmt <= 0) { setError("Montant invalide"); return; }
    setError(null);
    setSubmitting(true);
    timerRef.current = setTimeout(() => { setError("Délai dépassé. Réessayez."); setSubmitting(false); }, 90_000);
    try {
      await fieldsRef.current.submit({
        cardholderName: name.trim(),
        billingAddress: { addressLine1: billingAddress, adminArea2: billingCity, adminArea1: customer?.address?.admin_area_1 || "QC", postalCode: billingPostal, countryCode: "CA" },
      });
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!capturedRef.current) setSubmitting(false);
    } catch (e: any) {
      if (timerRef.current) clearTimeout(timerRef.current);
      const m = await getInvokeErrorMessage(e).catch(() => "Carte refusée. Vérifiez vos informations.");
      setError(m);
      setSubmitting(false);
    }
  };

  const boxStyle: React.CSSProperties = { height: 44, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", width: "100%", boxSizing: "border-box" };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ background: "rgba(124,58,237,0.08)", borderColor: "rgba(124,58,237,0.25)" }}>
        <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Montant à payer aujourd'hui</span></div>
        <span className="text-lg font-bold text-primary">{normalizedAmt > 0 ? `${normalizedAmt.toFixed(2)} $` : "…"}</span>
      </div>

      <div className="space-y-3">
        <div><Label className="text-xs font-medium mb-1.5 block">Nom sur la carte</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jean Tremblay" disabled={submitting} className="h-11 bg-white text-gray-900 border-gray-300" /></div>
        <div><Label className="text-xs font-medium mb-1.5 block">Numéro de carte</Label><div id={`cf-num-${uid}`} style={boxStyle} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs font-medium mb-1.5 block">Expiration</Label><div id={`cf-exp-${uid}`} style={boxStyle} /></div>
          <div><Label className="text-xs font-medium mb-1.5 block">CVV</Label><div id={`cf-cvv-${uid}`} style={boxStyle} /></div>
        </div>
      </div>

      {billingAddress && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <span className="font-semibold">Adresse de facturation :</span> {billingAddress}{billingCity ? `, ${billingCity}` : ""}{billingPostal ? ` ${billingPostal}` : ""}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="underline text-xs shrink-0">Fermer</button>
        </div>
      )}

      {!ready && !error && <div className="flex items-center gap-2 text-sm text-muted-foreground py-1"><Loader2 className="w-4 h-4 animate-spin" />Chargement du formulaire sécurisé…</div>}

      <Button type="submit" className="w-full h-12 text-base font-bold" disabled={disabled || submitting || !ready || normalizedAmt <= 0}>
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Traitement…</> : <><Lock className="w-4 h-4 mr-2" />Payer {normalizedAmt > 0 ? `${normalizedAmt.toFixed(2)} $` : ""} maintenant</>}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Paiement sécurisé par PayPal · Vos données bancaires ne sont jamais stockées sur notre site</p>
    </form>
  );
};

// ── Composant principal ─────────────────────────────────────────────────────
export const PayPalButton = ({ amount, invoiceId, orderId, description, customer, paymentNumber, onSuccess, onError, onCancel, disabled = false, className = "" }: PayPalButtonProps) => {
  const [sdkState, setSdkState] = useState<"loading" | "ready" | "error">("loading");
  const [hasCardFields, setHasCardFields] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const buttonsContainerId = `pp-btns-${orderId || invoiceId || "main"}`;
  const callbacksRef = useRef({ onSuccess, onError, onCancel });
  const buttonsRenderedRef = useRef(false);
  useEffect(() => { callbacksRef.current = { onSuccess, onError, onCancel }; });

  const normalizedAmt = useMemo(() => Math.round(amount * 100) / 100, [amount]);

  // ── 1. Charger le SDK PayPal ──────────────────────────────────────────────
  useEffect(() => {
    // Si déjà chargé avec les bons composants, utiliser directement
    if (window.paypal?.Buttons) {
      setSdkState("ready");
      setHasCardFields(!!window.paypal.CardFields);
      return;
    }
    // Supprimer un ancien script cassé si présent
    const existing = document.getElementById(PAYPAL_SDK_ID);
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = PAYPAL_SDK_ID;
    script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || ""}&currency=CAD&locale=fr_CA&enable-funding=card&components=buttons,card-fields,funding-eligibility`;
    script.async = true;
    script.onload = () => {
      setSdkState("ready");
      setHasCardFields(!!window.paypal?.CardFields);
    };
    script.onerror = () => setSdkState("error");
    document.body.appendChild(script);
  }, []);

  // ── 2. Rendre les boutons PayPal (PayPal + carte + Apple Pay + Google Pay) ─
  useEffect(() => {
    if (sdkState !== "ready" || !window.paypal?.Buttons || disabled || buttonsRenderedRef.current) return;
    const container = document.getElementById(buttonsContainerId);
    if (!container) return;
    buttonsRenderedRef.current = true;
    container.innerHTML = "";

    window.paypal.Buttons({
      style: { layout: "vertical", color: "gold", shape: "rect", label: "pay", height: 48 },
      createOrder: async () => {
        setIsProcessing(true);
        try {
          return await createOrder(normalizedAmt, invoiceId, orderId, description || "Paiement Nivra Telecom", customer);
        } catch (e) {
          const m = await getInvokeErrorMessage(e);
          toast.error(m);
          callbacksRef.current.onError?.(m);
          throw e;
        } finally { setIsProcessing(false); }
      },
      onApprove: async (d: { orderID: string }) => {
        setIsProcessing(true);
        try {
          const { captureId, payerAddress } = await captureOrder(d.orderID, invoiceId, orderId);
          toast.success("Paiement réussi !");
          if (paymentNumber) notifyNivraCorePaid({ paymentNumber, paypalOrderId: d.orderID, paypalCaptureId: captureId });
          callbacksRef.current.onSuccess?.(captureId, payerAddress);
        } catch (e) {
          const m = await getInvokeErrorMessage(e);
          toast.error(m);
          callbacksRef.current.onError?.(m);
        } finally { setIsProcessing(false); }
      },
      onCancel: () => { toast.info("Paiement annulé"); callbacksRef.current.onCancel?.(); },
      onError: async (e: any) => { const m = await getInvokeErrorMessage(e).catch(() => "Erreur PayPal"); toast.error(m); callbacksRef.current.onError?.(m); },
    }).render(`#${buttonsContainerId}`).catch((e: any) => { console.error("[PayPal Buttons render]", e); setSdkState("error"); });
  }, [sdkState, buttonsContainerId, disabled, normalizedAmt, invoiceId, orderId, description, customer]);

  if (!import.meta.env.VITE_PAYPAL_CLIENT_ID) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Configuration PayPal manquante — contactez le support.</div>;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Formulaire carte inline (si CardFields disponible) */}
      {sdkState === "ready" && hasCardFields && (
        <>
          <InlineCardForm
            amount={amount} invoiceId={invoiceId} orderId={orderId}
            description={description} customer={customer} paymentNumber={paymentNumber}
            onSuccess={onSuccess} onError={onError} disabled={disabled}
          />
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">ou payer avec</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </>
      )}

      {/* Spinner pendant traitement */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Traitement…</span>
        </div>
      )}

      {/* Boutons PayPal (PayPal / Carte / Apple Pay / Google Pay) */}
      {sdkState === "loading" && (
        <Button disabled className="w-full h-12">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement des options de paiement…
        </Button>
      )}
      {sdkState === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Impossible de charger PayPal. Vérifiez votre connexion internet et rechargez la page.
        </div>
      )}
      <div id={buttonsContainerId} className={isProcessing ? "opacity-50 pointer-events-none" : ""} />
    </div>
  );
};

export default PayPalButton;
