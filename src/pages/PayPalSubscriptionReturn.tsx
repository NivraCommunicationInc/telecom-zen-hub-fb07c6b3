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
import { supabase } from "@/integrations/supabase/client";
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
        const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
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
            await supabase
              .from("orders")
              .update({ recurring_payment_accepted: true } as any)
              .eq("id", orderId);
          } catch (e) {
            console.warn("[PayPalReturn] Order flag update failed:", e);
          }

          try {
            await supabase
              .from("checkout_consent_records" as any)
              .update({ recurring_payment_accepted: true })
              .eq("order_id", orderId);
          } catch (e) {
            console.warn("[PayPalReturn] Consent flag update failed:", e);
          }
        }

        if (storedOrder.order_number) setOrderNumber(storedOrder.order_number);

        localStorage.removeItem(STORAGE_KEY);
        setStatus("success");
      } catch (err: any) {
        console.error("[PayPalReturn] Error:", err);
        setErrorMsg(err?.message || "Une erreur est survenue lors de la confirmation.");
        setStatus("error");
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-12 max-w-2xl">
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
                <div className="inline-block px-4 py-2 bg-white rounded-lg border border-emerald-200">
                  <span className="text-xs text-muted-foreground">Commande&nbsp;</span>
                  <span className="font-mono font-bold text-foreground">#{orderNumber}</span>
                </div>
              )}

              {nextBillingTime && (
                <div className="inline-block px-4 py-2 ml-2 bg-white rounded-lg border border-emerald-200">
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

              <div className="bg-white rounded-xl p-4 border border-emerald-200 text-left text-sm space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold">
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
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader>
              <div className="w-16 h-16 mx-auto mb-2 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-center text-xl">
                Confirmation impossible
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-foreground">{errorMsg}</p>
              <div className="bg-white rounded-xl p-4 border border-red-200 text-left text-sm">
                <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
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
