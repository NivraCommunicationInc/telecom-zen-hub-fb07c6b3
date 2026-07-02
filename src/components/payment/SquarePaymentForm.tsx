import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";
const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface SquarePaymentFormProps {
  /** ID de la facture à payer (billing_invoices.id) — ou utiliser onBeforeCharge */
  invoiceId?: string;
  /** Appelé avant la charge si pas d'invoiceId — doit retourner invoice_id ou intent_id */
  onBeforeCharge?: () => Promise<{ invoice_id?: string; intent_id?: string }>;
  /** Montant affiché sur le bouton */
  amount: number;
  /** Numéro de facture lisible — pour la note Square */
  invoiceNumber?: string;
  /** Pour la note Square (visible dans le dashboard Square) */
  customerName?: string;
  customerEmail?: string;
  /** Appelé si le paiement réussit */
  onSuccess: (receiptUrl?: string | null, paymentId?: string) => void;
}

export function SquarePaymentForm({
  invoiceId,
  onBeforeCharge,
  amount,
  invoiceNumber,
  customerName,
  customerEmail,
  onSuccess,
}: SquarePaymentFormProps) {
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [squareRef, setSquareRef] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);

  // Load Square.js + attach card widget
  useEffect(() => {
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
        await card.attach(containerRef.current!);

        if (destroyed) { card.destroy(); return; }
        cardRef.current = card;
        setLoading(false);
      } catch (e: any) {
        if (!destroyed) {
          toast.error("Erreur chargement formulaire : " + (e?.message || String(e)));
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      cardRef.current?.destroy?.();
      cardRef.current = null;
    };
  }, []);

  const handlePay = async () => {
    if (!cardRef.current) {
      toast.error("Formulaire non prêt — rechargez la page.");
      return;
    }
    setPaying(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        toast.error(result.errors?.[0]?.message || "Informations de carte invalides");
        return;
      }

      let chargeBody: Record<string, any> = { source_id: result.token, customer_email: customerEmail };
      if (onBeforeCharge) {
        const ids = await onBeforeCharge();
        if (ids.intent_id) chargeBody.intent_id = ids.intent_id;
        else if (ids.invoice_id) chargeBody.invoice_id = ids.invoice_id;
        else throw new Error("onBeforeCharge n'a retourné aucun identifiant valide");
      } else {
        chargeBody.invoice_id = invoiceId;
      }

      const res = await fetch(`${BACKEND_URL}/functions/v1/square-charge-invoice`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BACKEND_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chargeBody),
      });

      const data = await res.json();
      if (!data?.ok) {
        toast.error(data?.error || "Paiement refusé");
        return;
      }

      setDone(true);
      toast.success("Paiement accepté !");
      onSuccess(data.receipt_url ?? null, data.payment_id);
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setPaying(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center py-6 gap-3 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <p className="font-semibold text-foreground">Paiement accepté !</p>
        <p className="text-sm text-muted-foreground">
          {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} débité sur votre carte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Square card widget */}
      <div ref={containerRef} id="sq-card-container" className="min-h-[90px]" />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement du formulaire…
        </div>
      )}

      <Button
        onClick={handlePay}
        disabled={loading || paying}
        className="w-full"
        size="lg"
      >
        {paying ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" />Traitement…</>
        ) : (
          <><CreditCard className="w-4 h-4 mr-2" />
            Payer {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} par carte</>
        )}
      </Button>
    </div>
  );
}
