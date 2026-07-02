import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Loader2, CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { SquarePaymentForm } from "@/components/payment/SquarePaymentForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const fmt = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

interface Intent {
  id: string;
  amount: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  description: string;
  invoice_number: string | null;
}

export default function PayerPublicByToken() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [paidOk, setPaidOk] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/functions/v1/public-payment-link-resolve`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BACKEND_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!data?.ok) {
          setError(data?.error || "Lien invalide");
        } else {
          setIntent(data.intent);
        }
      } catch (e: any) {
        setError(e?.message || "Erreur réseau");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <>
      <SEOHead title="Paiement — Nivra Telecom" description="Payer votre lien de paiement Nivra." />
      <Header />
      <main style={{ minHeight: "80vh", background: "#020209", paddingTop: 100, paddingBottom: 60 }}>
        <div className="mx-auto px-4" style={{ maxWidth: 640 }}>
          {loading && (
            <Card className="p-8 text-center text-white/70" style={{ background: "#0b0b17", borderColor: "rgba(255,255,255,0.08)" }}>
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
              Chargement du lien de paiement…
            </Card>
          )}

          {error && (
            <Card className="p-8 text-center" style={{ background: "#0b0b17", borderColor: "rgba(255,255,255,0.08)" }}>
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <h1 className="text-xl font-bold text-white mb-2">Lien inaccessible</h1>
              <p className="text-white/60 text-sm">{error}</p>
            </Card>
          )}

          {intent && !paidOk && (
            <Card className="p-6 md:p-8" style={{ background: "#0b0b17", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style={{ background: "rgba(124,58,237,0.15)" }}>
                  <CreditCard className="w-6 h-6" style={{ color: "#A78BFA" }} />
                </div>
                <h1 className="text-2xl font-bold text-white">
                  Bonjour {intent.customer_name || "cher client"},
                </h1>
              </div>

              <div className="rounded-lg p-4 mb-6" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)" }}>
                <div className="text-white/70 text-sm mb-1">Description</div>
                <div className="text-white text-base mb-4">{intent.description || "Paiement Nivra Telecom"}</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-white/70 text-sm">Montant à payer</span>
                  <span className="text-2xl font-bold text-white">{fmt(intent.amount)}</span>
                </div>
                {intent.invoice_number && (
                  <div className="text-xs text-white/50 mt-1">Facture #{intent.invoice_number}</div>
                )}
              </div>

              <div className="mb-3 text-sm text-white/70 font-medium">Paiement par carte de crédit</div>
              <SquarePaymentForm
                onBeforeCharge={async () => ({ intent_id: intent.id })}
                amount={intent.amount}
                customerName={intent.customer_name || undefined}
                customerEmail={intent.customer_email || undefined}
                paymentSource="public_pay"
                onSuccess={() => {
                  setPaidOk(true);
                  toast.success("Paiement confirmé — merci !");
                }}
              />
              <p className="mt-4 text-xs text-white/40 text-center">
                Paiement sécurisé traité par Square. Nous ne conservons aucune information de carte.
              </p>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
