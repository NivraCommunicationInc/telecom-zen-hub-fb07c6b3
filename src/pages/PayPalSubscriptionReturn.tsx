/**
 * PayPalSubscriptionReturn — Return URL handler for PayPal pre-authorized subscription approval.
 *
 * PayPal redirects clients here after they approve the recurring billing agreement.
 * Query params provided by PayPal:
 *   - subscription_id (PayPal subscription ID, e.g. I-XXXXX)
 *   - ba_token (billing agreement token)
 *   - token (approval token)
 *
 * We persist the order_id in localStorage at checkout submission time, so we can
 * reconcile the order with the approved subscription on return.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { portalClient } from "@/integrations/backend/portalClient";
import { clearPayPalFlowActive } from "@/hooks/useClientAutoPayEnrollment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, CreditCard, Mail } from "lucide-react";
import Header from "@/components/Header";

type Status = "loading" | "success" | "error";

const STORAGE_KEY = "nivra-paypal-pending-order";

const PayPalSubscriptionReturn = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [nextBillingTime, setNextBillingTime] = useState<string | null>(null);

  useEffect(() => {
    const subscriptionId = searchParams.get("subscription_id");
    const orderQuery = searchParams.get("order");

    let storedOrder: { order_id?: string; order_number?: string } = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) storedOrder = JSON.parse(raw);
    } catch {
      // ignore corrupted storage
    }

    const orderId = storedOrder.order_id || (orderQuery && orderQuery !== "new" ? orderQuery : undefined);

    if (!subscriptionId) {
      setErrorMsg(
        "Identifiant d'abonnement PayPal manquant. Si votre carte a été débitée, contactez le support à info@nivra-telecom.ca."
      );
      setStatus("error");
      return;
    }

    (async () => {
      try {
        // ── Étape 1: Vérifier côté Nivra Core que l'entente est bien ACTIVE chez PayPal
        // (au lieu de simplement faire confiance au query param)
        const { data: verifyData, error: verifyErr } = await portalClient.functions.invoke(
          "paypal-verify-subscription",
          { body: { paypal_subscription_id: subscriptionId } }
        );

        if (verifyErr) {
          throw new Error(verifyErr.message || "Vérification PayPal impossible");
        }

        if (!verifyData?.success) {
          throw new Error(verifyData?.error || "L'entente n'a pas pu être confirmée");
        }

        if (!verifyData.is_active) {
          throw new Error(
            `L'entente PayPal n'est pas encore active (statut: ${verifyData.paypal_status}). ` +
            `Veuillez patienter quelques minutes ou réessayer. Si le problème persiste, contactez le support.`
          );
        }

        if (verifyData.next_billing_time) {
          setNextBillingTime(verifyData.next_billing_time);
        }

        // ── Étape 2: Marquer la commande comme récurrente (best-effort, le webhook reste source de vérité)
        if (orderId) {
          try {
            await portalClient
              .from("orders")
              .update({ recurring_payment_accepted: true } as any)
              .eq("id", orderId);
          } catch (e) {
            console.warn("[PayPalReturn] Order flag update failed:", e);
          }

          try {
            await portalClient
              .from("checkout_consent_records" as any)
              .update({ recurring_payment_accepted: true })
              .eq("order_id", orderId);
          } catch (e) {
            console.warn("[PayPalReturn] Consent flag update failed:", e);
          }
        }

        if (storedOrder.order_number) setOrderNumber(storedOrder.order_number);

        localStorage.removeItem(STORAGE_KEY);
        clearPayPalFlowActive();
        setStatus("success");
      } catch (err: any) {
        console.error("[PayPalReturn] Error:", err);
        clearPayPalFlowActive();
        setErrorMsg(err?.message || "Une erreur est survenue lors de la confirmation.");
        setStatus("error");
      }
    })();
  }, [searchParams]);

  return (
    <div style={{ background: '#020209' }} className="relative min-h-screen overflow-hidden">
      <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-8%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.14) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-6%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
      <Header />
      <div className="relative container mx-auto px-4 py-12 max-w-2xl">
        {status === "loading" && (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
              <h1 className="text-xl font-semibold text-foreground">
                Confirmation de votre paiement pré-autorisé...
              </h1>
              <p className="text-sm text-muted-foreground">
                Nous activons votre abonnement automatique. Cela ne prend que quelques secondes.
              </p>
            </CardContent>
          </Card>
        )}

        {status === "success" && (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardHeader>
              <div className="w-16 h-16 mx-auto mb-2 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <CardTitle className="text-center text-2xl">
                Paiement pré-autorisé activé
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <p className="text-foreground">
                Vous serez facturé automatiquement chaque mois. Profitez de votre rabais
                de <strong>5 $/mois</strong> sur chaque facture, à vie.
              </p>

              {orderNumber && (
                <div className="inline-block px-4 py-2 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
                  <span className="text-xs text-muted-foreground">Commande&nbsp;</span>
                  <span className="font-mono font-bold text-foreground">#{orderNumber}</span>
                </div>
              )}

              {nextBillingTime && (
                <div className="inline-block px-4 py-2 ml-2 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
                  <span className="text-xs text-muted-foreground">Prochain prélèvement&nbsp;</span>
                  <span className="font-semibold text-foreground">
                    {new Date(nextBillingTime).toLocaleDateString("fr-CA", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}

              <div className="rounded-xl p-4 text-left text-sm space-y-2" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <div className="flex items-center gap-2 font-semibold" style={{ color: "#6ee7b7" }}>
                  <CreditCard className="w-4 h-4" /> Prochaines étapes
                </div>
                <ul className="space-y-1 text-muted-foreground pl-6 list-disc">
                  <li>PayPal débitera votre carte automatiquement à chaque cycle.</li>
                  <li>Vous recevrez une facture par courriel avant chaque débit.</li>
                  <li>Vous pouvez retirer le paiement automatique en tout temps depuis votre portail.</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button onClick={() => navigate("/portal/services")}>
                  Voir ma commande
                </Button>
                <Button variant="outline" onClick={() => navigate("/")}>
                  Retour à l'accueil
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {status === "error" && (
          <Card style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)" }}>
            <CardHeader>
              <div className="w-16 h-16 mx-auto mb-2 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)" }}>
                <AlertCircle className="w-8 h-8" style={{ color: "#fca5a5" }} />
              </div>
              <CardTitle className="text-center text-xl">
                Confirmation impossible
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-foreground">{errorMsg}</p>
              <div className="rounded-xl p-4 text-left text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <div className="flex items-center gap-2 font-semibold mb-2" style={{ color: "#fca5a5" }}>
                  <Mail className="w-4 h-4" /> Besoin d'aide ?
                </div>
                <p className="text-muted-foreground">
                  Écrivez-nous à{" "}
                  <a className="text-primary underline" href="mailto:info@nivra-telecom.ca">
                    info@nivra-telecom.ca
                  </a>{" "}
                  avec le numéro de votre commande. Notre équipe vérifiera l'état du paiement et vous répondra rapidement.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild variant="outline">
                  <Link to="/">Retour à l'accueil</Link>
                </Button>
                <Button asChild>
                  <Link to="/portal/services">Mon portail</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PayPalSubscriptionReturn;
