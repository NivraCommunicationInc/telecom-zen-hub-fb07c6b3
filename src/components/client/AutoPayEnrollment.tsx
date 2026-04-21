import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Wrench, RefreshCw, ExternalLink, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { useClientAutoPayEnrollment } from "@/hooks/useClientAutoPayEnrollment";

const AutoPayEnrollment = () => {
  const queryClient = useQueryClient();
  const { subscriptions, isLoading, enrollInPayPal, enrollingSubscriptionId } = useClientAutoPayEnrollment();

  const handleDisableAutoPay = async (subscription: any) => {
    try {
      await portalSupabase
        .from("billing_subscriptions")
        .update({ auto_billing_enabled: false })
        .eq("id", subscription.id);

      toast.success("Paiement automatique désactivé");
      queryClient.invalidateQueries({ queryKey: ["client-billing-subscriptions"] });
    } catch (error) {
      toast.error("Erreur lors de la désactivation");
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white border border-slate-200">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    return null; // No subscriptions, don't show the section
  }

  return (
    <Card className="bg-white border-2 border-teal-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <RefreshCw className="w-5 h-5 text-teal-600" />
            Paiement automatique
          </CardTitle>
        </div>
        <CardDescription>
          Activez le renouvellement automatique pour ne jamais perdre votre service.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {subscriptions.map((sub: any) => {
          const isAutoPayActive = sub.auto_billing_enabled && sub.paypal_subscription_id;

          return (
            <div
              key={sub.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{sub.plan_name}</p>
                  <p className="text-sm text-slate-500">
                    {Number(sub.plan_price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                  </p>
                </div>
                <Badge className={isAutoPayActive
                  ? "bg-emerald-100 text-emerald-700 border-0"
                  : "bg-slate-100 text-slate-600 border-0"
                }>
                  {isAutoPayActive ? "Automatique" : "Manuel"}
                </Badge>
              </div>

              {isAutoPayActive ? (
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700 font-medium">Paiement automatique PayPal activé</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => handleDisableAutoPay(sub)}
                  >
                    Désactiver
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* PayPal auto-pay */}
                  <Button
                    className="w-full bg-[#0070ba] hover:bg-[#005ea6] text-white gap-2"
                     onClick={() => void enrollInPayPal(sub)}
                     disabled={!!enrollingSubscriptionId}
                  >
                     {enrollingSubscriptionId === sub.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <path d="M19.554 9.488c.121.563.106 1.246-.04 2.017-.582 2.464-2.477 3.88-5.336 3.88h-.71c-.323 0-.6.216-.665.524l-.513 3.292-.146.935c-.033.211.127.403.34.403h2.398c.283 0 .526-.19.581-.468l.024-.123.46-2.922.03-.163c.055-.278.298-.468.58-.468h.367c2.369 0 4.221-1.042 4.762-4.057.226-1.261.11-2.314-.488-3.054a2.57 2.57 0 0 0-.644-.563c.138.244.252.505.34.78z" fill="white"/>
                        <path d="M18.474 9.081a5.97 5.97 0 0 0-.74-.195 9.456 9.456 0 0 0-1.505-.11h-4.562c-.283 0-.526.19-.581.467l-.973 6.17-.028.18c.065-.308.342-.524.665-.524h1.386c2.84 0 5.062-1.155 5.713-4.495.019-.099.036-.195.05-.289a3.09 3.09 0 0 0-.425-.204z" fill="rgba(255,255,255,0.8)"/>
                        <path d="M10.663 9.243a.595.595 0 0 1 .58-.467h4.563c.541 0 1.047.037 1.505.11.129.02.254.045.375.073.128.03.25.063.365.1.058.018.113.038.168.058a3.1 3.1 0 0 1 .257.103c.086-.55.085-1.106-.027-1.648-.376-1.822-1.667-2.573-3.612-2.573h-5.8c-.323 0-.6.216-.665.524L6.67 17.403c-.04.253.152.48.408.48h2.972l.746-4.733.867-3.907z" fill="rgba(255,255,255,0.6)"/>
                      </svg>
                    )}
                    Activer avec PayPal
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>

                  {/* Credit card auto-pay */}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Carte de crédit
                    <Badge variant="outline" className="text-xs text-primary border-primary/30 gap-1 ml-auto">
                      Bientôt
                    </Badge>
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default AutoPayEnrollment;
