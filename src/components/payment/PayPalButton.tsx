import { useState, useEffect, useMemo, useRef } from "react";
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
  interface Window {
    paypal?: any;
  }
}

// ── Inline card form using PayPal CardFields API ──
const InlineCardForm = ({
  amount, invoiceId, orderId, description, customer, paymentNumber,
  onSuccess, onError, disabled,
}: PayPalButtonProps) => {
  const [cardholderName, setCardholderName] = useState(
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ")
  );
  // Adresse de facturation = adresse de service (obligatoire pour éviter les fraudes)
  const billingAddress = customer?.address?.address_line_1 || "";
  const billingCity    = customer?.address?.admin_area_2   || "";
  const billingPostal  = (customer?.address?.postal_code   || "").replace(/\s/g, "").toUpperCase();

  const [submitting, setSubmitting] = useState(false);
  const [fieldsReady, setFieldsReady] = useState(false);
  const [fieldError, setFieldError]   = useState<string | null>(null);
  const cardFieldsRef = useRef<any>(null);
  const mountedRef    = useRef(false);
  // Separate ref for capture — onApprove must NOT be gated by the submit flag
  const capturedRef   = useRef(false);
  const timeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uid = orderId || invoiceId || "main";
  const numberId = `cf-number-${uid}`;
  const expiryId = `cf-expiry-${uid}`;
  const cvvId    = `cf-cvv-${uid}`;

  const normalizedAmount = useMemo(() => Math.round(amount * 100) / 100, [amount]);

  const createPayPalOrder = async () => {
    const { data, error } = await supabase.functions.invoke("paypal-create-order", {
      body: { amount: normalizedAmount, invoice_id: invoiceId, order_id: orderId, description: description || "Paiement Nivra Telecom", customer },
    });
    if (error) throw error;
    if (!data?.paypal_order_id) throw new Error("Aucun ID de commande PayPal retourné");
    return data.paypal_order_id as string;
  };

  const capturePayPalOrder = async (paypalOrderId: string) => {
    const { data, error } = await supabase.functions.invoke("paypal-capture-order", {
      body: { paypal_order_id: paypalOrderId, invoice_id: invoiceId, order_id: orderId },
    });
    if (error) throw error;
    if (!data?.capture_id) throw new Error("Capture ID manquant");
    return { captureId: data.capture_id as string, payerAddress: data.payer_address ?? null };
  };

  useEffect(() => {
    if (mountedRef.current || !window.paypal?.CardFields) return;
    mountedRef.current = true;

    try {
      const fields = window.paypal.CardFields({
        createOrder: async () => {
          try { return await createPayPalOrder(); }
          catch (err: any) {
            const msg = await getInvokeErrorMessage(err);
            setFieldError(msg);
            throw err;
          }
        },
        // onApprove fires AFTER PayPal processes the card — never gated by submit flag
        onApprove: async (data: { orderID: string }) => {
          if (capturedRef.current) return;
          capturedRef.current = true;
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setSubmitting(true);
          setFieldError(null);
          try {
            const { captureId, payerAddress } = await capturePayPalOrder(data.orderID);
            toast.success("Paiement réussi !");
            if (paymentNumber) notifyNivraCorePaid({ paymentNumber, paypalOrderId: data.orderID, paypalCaptureId: captureId });
            onSuccess?.(captureId, payerAddress);
          } catch (err: any) {
            const msg = await getInvokeErrorMessage(err);
            setFieldError(msg);
            onError?.(msg);
            capturedRef.current = false;
            setSubmitting(false);
          }
        },
        onError: async (err: any) => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          const msg = await getInvokeErrorMessage(err).catch(() => "Erreur de paiement PayPal");
          setFieldError(msg);
          onError?.(msg);
          setSubmitting(false);
        },
        style: {
          input: {
            "font-size": "15px",
            "font-family": "Inter, system-ui, sans-serif",
            color: "#111827",        // texte foncé — lisible sur fond blanc des iframes PayPal
            "background-color": "transparent",
            padding: "0 12px",
          },
          ".invalid": { color: "#dc2626" },
          ":focus":   { color: "#111827" },
          "::placeholder": { color: "#9ca3af" },
        },
      });

      if (fields.isEligible()) {
        cardFieldsRef.current = fields;
        fields.NumberField({ placeholder: "1234 5678 9012 3456" }).render(`#${numberId}`);
        fields.ExpiryField({ placeholder: "MM/AA"              }).render(`#${expiryId}`);
        fields.CVVField   ({ placeholder: "123"                }).render(`#${cvvId}`);
        setFieldsReady(true);
      } else {
        setFieldError("Paiement par carte non disponible. Utilisez le bouton PayPal ci-dessous.");
      }
    } catch (err) {
      console.error("[PayPalCardFields] init error:", err);
      setFieldError("Impossible de charger le formulaire de carte.");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !cardFieldsRef.current || capturedRef.current) return;
    if (!cardholderName.trim()) { setFieldError("Entrez le nom sur la carte"); return; }
    if (!billingPostal)         { setFieldError("Adresse de service manquante — retournez à l'étape 2 et entrez votre adresse."); return; }
    if (normalizedAmount <= 0)  { setFieldError("Montant invalide"); return; }

    setFieldError(null);
    setSubmitting(true);

    // Timeout de sécurité — si PayPal ne répond pas en 90s
    timeoutRef.current = setTimeout(() => {
      setFieldError("Le paiement prend trop de temps. Veuillez réessayer.");
      setSubmitting(false);
    }, 90_000);

    try {
      await cardFieldsRef.current.submit({
        cardholderName: cardholderName.trim(),
        billingAddress: {
          addressLine1: billingAddress.trim() || customer?.address?.address_line_1 || "",
          adminArea2:   billingCity.trim()    || customer?.address?.admin_area_2   || "",
          adminArea1:   customer?.address?.admin_area_1 || "QC",
          postalCode:   billingPostal.replace(/\s/g, "").toUpperCase(),
          countryCode:  "CA",
        },
      });
      // submit() résolu = PayPal a déclenché onApprove ou onError
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (!capturedRef.current) setSubmitting(false); // onApprove n'a pas encore répondu
    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const msg = await getInvokeErrorMessage(err).catch(() => "Carte refusée. Vérifiez vos informations.");
      setFieldError(msg);
      onError?.(msg);
      setSubmitting(false);
    }
  };

  const iframeStyle: React.CSSProperties = {
    height: 44, border: '1px solid #d1d5db', borderRadius: 8,
    background: '#ffffff', width: '100%', boxSizing: 'border-box' as const,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Montant */}
      <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ background: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.25)' }}>
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Montant à payer aujourd'hui</span>
        </div>
        <span className="text-lg font-bold text-primary">
          {normalizedAmount > 0 ? `${normalizedAmount.toFixed(2)} $` : "Calcul en cours…"}
        </span>
      </div>

      {/* Champs carte */}
      <div className="space-y-3">
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Nom sur la carte</Label>
          <Input value={cardholderName} onChange={e => setCardholderName(e.target.value)}
            placeholder="Jean Tremblay" disabled={submitting} className="h-11 bg-white text-gray-900 border-gray-300" />
        </div>
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Numéro de carte</Label>
          <div id={numberId} style={iframeStyle} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Date d'expiration</Label>
            <div id={expiryId} style={iframeStyle} />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">CVV</Label>
            <div id={cvvId} style={iframeStyle} />
          </div>
        </div>
      </div>

      {/* Adresse de facturation = adresse de service */}
      {billingAddress && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 flex items-start gap-2">
          <span className="text-blue-500 text-base leading-none mt-0.5">ℹ</span>
          <div className="text-xs text-blue-700">
            <span className="font-semibold">Adresse de facturation :</span> votre adresse de service est utilisée automatiquement
            {billingAddress && <span className="block text-blue-600 mt-0.5">{billingAddress}{billingCity ? `, ${billingCity}` : ""}{billingPostal ? ` ${billingPostal}` : ""}</span>}
          </div>
        </div>
      )}

      {/* Erreur */}
      {fieldError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-2">
          <span>{fieldError}</span>
          <button type="button" onClick={() => setFieldError(null)} className="underline text-xs shrink-0">Fermer</button>
        </div>
      )}

      {!fieldsReady && !fieldError && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement du formulaire sécurisé…
        </div>
      )}

      {/* Bouton soumettre */}
      <Button type="submit" className="w-full h-12 text-base font-bold"
        disabled={disabled || submitting || !fieldsReady || normalizedAmount <= 0}>
        {submitting
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Traitement en cours…</>
          : <><Lock className="w-4 h-4 mr-2" />Payer {normalizedAmount > 0 ? `${normalizedAmount.toFixed(2)} $` : ""} maintenant</>
        }
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Paiement sécurisé par PayPal · Vos données bancaires ne sont jamais stockées sur notre site
      </p>
    </form>
  );
};

// ── Main PayPalButton component ──
export const PayPalButton = ({
  amount, invoiceId, orderId, description, customer, paymentNumber,
  onSuccess, onError, onCancel, disabled = false, className = "",
}: PayPalButtonProps) => {
  const [sdkReady, setSdkReady] = useState(false);
  const [hasCardFields, setHasCardFields] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerId = `paypal-button-container-${invoiceId || orderId || "main"}`;
  const callbacksRef = useRef({ onSuccess, onError, onCancel });
  useEffect(() => { callbacksRef.current = { onSuccess, onError, onCancel }; }, [onSuccess, onError, onCancel]);

  const normalizedAmount = useMemo(() => Math.round(amount * 100) / 100, [amount]);
  const renderKey = useMemo(() => [normalizedAmount, invoiceId ?? "", orderId ?? "", description ?? ""].join("::"), [normalizedAmount, invoiceId, orderId, description]);
  const lastRenderedKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef<{ create: boolean; capture: boolean }>({ create: false, capture: false });
  const lastOrderIdRef = useRef<string | null>(null);

  // Load PayPal SDK with card-fields support
  useEffect(() => {
    if (window.paypal) { setSdkReady(true); setHasCardFields(!!window.paypal.CardFields); return; }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || ""}&currency=CAD&locale=fr_CA&enable-funding=card&components=buttons,card-fields,funding-eligibility`;
    script.async = true;
    script.onload = () => { setSdkReady(true); setHasCardFields(!!window.paypal?.CardFields); };
    script.onerror = () => { toast.error("Erreur de chargement PayPal"); };
    document.body.appendChild(script);
  }, []);

  // Render PayPal Buttons (fallback for PayPal account payment)
  useEffect(() => {
    if (!sdkReady || !window.paypal?.Buttons || disabled) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    if (lastRenderedKeyRef.current === renderKey) return;
    lastRenderedKeyRef.current = renderKey;
    container.innerHTML = "";

    window.paypal.Buttons({
      style: { layout: "horizontal", color: "blue", shape: "rect", label: "pay", height: 45 },
      createOrder: async () => {
        if (inFlightRef.current.create) { if (lastOrderIdRef.current) return lastOrderIdRef.current; await new Promise(r => setTimeout(r, 250)); if (lastOrderIdRef.current) return lastOrderIdRef.current; }
        inFlightRef.current.create = true; setIsLoading(true);
        try {
          if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) throw new Error("Montant PayPal invalide.");
          const { data, error } = await supabase.functions.invoke("paypal-create-order", {
            body: { amount: normalizedAmount, invoice_id: invoiceId, order_id: orderId, description: description || "Paiement Nivra Telecom", customer },
          });
          if (error) throw error;
          if (!data?.paypal_order_id) throw new Error("No order ID returned");
          lastOrderIdRef.current = data.paypal_order_id;
          return data.paypal_order_id;
        } catch (err) {
          const msg = await getInvokeErrorMessage(err);
          toast.error(msg); callbacksRef.current.onError?.(msg); throw err;
        } finally { inFlightRef.current.create = false; setIsLoading(false); }
      },
      onApprove: async (data: { orderID: string }) => {
        if (inFlightRef.current.capture) return;
        inFlightRef.current.capture = true; setIsLoading(true);
        try {
          const { data: cap, error } = await supabase.functions.invoke("paypal-capture-order", {
            body: { paypal_order_id: data.orderID, invoice_id: invoiceId, order_id: orderId },
          });
          if (error) throw error;
          if (!cap?.capture_id) throw new Error("No capture ID");
          toast.success("Paiement PayPal réussi !");
          if (paymentNumber) notifyNivraCorePaid({ paymentNumber, paypalOrderId: data.orderID, paypalCaptureId: cap.capture_id });
          callbacksRef.current.onSuccess?.(cap.capture_id, cap.payer_address ?? null);
        } catch (err) {
          const msg = await getInvokeErrorMessage(err); toast.error(msg); callbacksRef.current.onError?.(msg);
        } finally { inFlightRef.current.capture = false; setIsLoading(false); }
      },
      onCancel: () => { toast.info("Paiement PayPal annulé"); callbacksRef.current.onCancel?.(); },
      onError: (err: Error) => { toast.error("Erreur PayPal. Veuillez réessayer."); callbacksRef.current.onError?.(err.message || "Unknown PayPal error"); },
    }).render(`#${containerId}`);
  }, [sdkReady, containerId, disabled, renderKey, normalizedAmount, invoiceId, orderId, description, customer]);

  if (!import.meta.env.VITE_PAYPAL_CLIENT_ID) {
    return <div className="text-sm text-destructive">Configuration PayPal manquante</div>;
  }

  return (
    <div className={className}>
      {/* Inline card form (shown first if CardFields API available) */}
      {sdkReady && hasCardFields && (
        <InlineCardForm
          amount={amount} invoiceId={invoiceId} orderId={orderId}
          description={description} customer={customer} paymentNumber={paymentNumber}
          onSuccess={onSuccess} onError={onError} onCancel={onCancel} disabled={disabled}
        />
      )}

      {/* Divider between card form and PayPal button */}
      {sdkReady && hasCardFields && (
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-medium">ou payer avec</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* PayPal Buttons (account payment fallback) */}
      {isLoading && (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Traitement…</span>
        </div>
      )}
      <div id={containerId} className={isLoading ? "opacity-50 pointer-events-none" : ""} />
      {!sdkReady && (
        <Button disabled className="w-full">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement PayPal…
        </Button>
      )}
    </div>
  );
};

export default PayPalButton;
