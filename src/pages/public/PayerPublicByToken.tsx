import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, AlertTriangle, CheckCircle2, Copy, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SquarePaymentForm } from "@/components/payment/SquarePaymentForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const fmt = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

const maskEmail = (email: string | null | undefined): string => {
  if (!email) return "votre adresse courriel";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"*".repeat(Math.max(1, user.length - visible.length))}@${domain}`;
};

interface Intent {
  id: string;
  amount: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  description: string;
  invoice_number: string | null;
}

interface PaidInfo {
  squareRef: string | null;
  receiptUrl: string | null;
  paidAt: Date;
}

export default function PayerPublicByToken() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [paid, setPaid] = useState<PaidInfo | null>(null);

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

  const copyRef = (value: string, label: string) => {
    navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} copié`),
      () => toast.error("Impossible de copier"),
    );
  };

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

          {intent && !paid && (
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
                onSuccess={(receiptUrl, paymentId) => {
                  setPaid({
                    squareRef: paymentId ?? null,
                    receiptUrl: receiptUrl ?? null,
                    paidAt: new Date(),
                  });
                }}
              />
              <p className="mt-4 text-xs text-white/40 text-center">
                Paiement sécurisé traité par Square. Nous ne conservons aucune information de carte.
              </p>
            </Card>
          )}

          {intent && paid && (
            <Card className="p-6 md:p-8 bg-white border-0 shadow-2xl">
              {/* Animated checkmark */}
              <div className="flex justify-center mb-4">
                <div
                  className="inline-flex items-center justify-center rounded-full bg-emerald-100 animate-in zoom-in duration-500"
                  style={{ width: 96, height: 96 }}
                >
                  <CheckCircle2 className="w-16 h-16 text-emerald-600" strokeWidth={2.5} />
                </div>
              </div>

              <h1 className="text-3xl font-bold text-emerald-600 text-center mb-6">
                Paiement accepté !
              </h1>

              {/* NVR reference box */}
              {intent.invoice_number && (
                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 mb-4">
                  <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold mb-2">
                    Numéro de facture
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-2xl md:text-3xl font-bold text-gray-900 font-mono break-all">
                      {intent.invoice_number}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyRef(intent.invoice_number!, "Numéro de facture")}
                      className="shrink-0"
                    >
                      <Copy className="w-4 h-4 mr-1" /> Copier
                    </Button>
                  </div>
                </div>
              )}

              {/* Square reference — smaller/grey */}
              {paid.squareRef && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">
                        Référence Square
                      </div>
                      <div className="text-sm font-mono text-gray-700 break-all">{paid.squareRef}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyRef(paid.squareRef!, "Référence Square")}
                      className="shrink-0 text-gray-600"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Amount + date */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500 mb-1">Montant payé</div>
                  <div className="text-lg font-bold text-gray-900">{fmt(intent.amount)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500 mb-1">Date et heure</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {paid.paidAt.toLocaleString("fr-CA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="rounded-lg border border-gray-200 p-3 mb-4">
                <div className="text-xs text-gray-500 mb-1">Service payé</div>
                <div className="text-sm text-gray-900">
                  {intent.description || "Paiement Nivra Telecom"}
                </div>
              </div>

              {/* Email confirmation */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-6 text-sm text-blue-900 text-center">
                Un courriel de confirmation a été envoyé à{" "}
                <span className="font-semibold">{maskEmail(intent.customer_email)}</span>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                {paid.receiptUrl && (
                  <Button
                    asChild
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    size="lg"
                  >
                    <a href={paid.receiptUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger mon reçu
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => navigate("/payer")}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Payer une autre facture
                </Button>
              </div>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
