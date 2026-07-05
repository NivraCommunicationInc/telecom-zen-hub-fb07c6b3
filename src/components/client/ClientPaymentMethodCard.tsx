import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQueryClient } from "@tanstack/react-query";
import { portalClient } from "@/integrations/backend";
import { useClientAutoPayEnrollment } from "@/hooks/useClientAutoPayEnrollment";
import { PayPalAutoPayErrorDialog } from "@/components/client/PayPalAutoPayErrorDialog";

export const ClientPaymentMethodCard = () => {
  const { user } = useClientAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const {
    activePayPalSubscription,
    enrollInPayPal,
    enrollingSubscriptionId,
    isLoading,
    eligibilityLoading,
    lastError,
    clearLastError,
  } = useClientAutoPayEnrollment();

  const hasAutopay = !!activePayPalSubscription?.paypal_subscription_id;

  useEffect(() => {
    if (lastError) setErrorOpen(true);
  }, [lastError]);

  const refreshAutopayState = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["client-billing-subscriptions", user?.id] }),
      qc.invalidateQueries({ queryKey: ["client-autopay-eligibility", user?.id] }),
      qc.invalidateQueries({ queryKey: ["canonical-client-data", user?.id] }),
    ]);
  };

  const handleActivatePayPal = async () => {
    if (!user?.id) return;
    const started = await enrollInPayPal(null);
    if (!started) setErrorOpen(true);
  };

  const handleDetachCard = async () => {
    if (!activePayPalSubscription?.id) return;
    if (!confirm("Désactiver le paiement automatique ? Vos prochaines factures devront être payées manuellement.")) return;
    setSaving(true);
    try {
      const { data, error } = await portalClient.functions.invoke("paypal-cancel-subscription", {
        body: {
          subscription_id: activePayPalSubscription.id,
          reason: "Désactivation depuis le portail client",
        },
      });
      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Erreur lors de la désactivation");
        return;
      }
      toast.success("Paiement automatique désactivé");
      await refreshAutopayState();
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || eligibilityLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className={hasAutopay ? "border-emerald-300/50 bg-emerald-50/30" : "border-primary/20"}>
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-base ${hasAutopay ? "text-emerald-700" : ""}`}>
          <CreditCard className="h-4 w-4" />
          Paiement automatique
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasAutopay ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-800">Autopay actif</span>
              <Badge variant="secondary" className="text-xs">
                PayPal préautorisé
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 shrink-0" />
              Votre abonnement se renouvelle automatiquement via PayPal. Rabais de 5 $/mois inclus.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleDetachCard} disabled={saving} className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50">
                {saving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />…</> : "Désactiver"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Activer le prélèvement automatique
              </p>
              <p className="text-xs text-muted-foreground">
                Autorisez PayPal une seule fois pour renouveler votre abonnement automatiquement. Rabais de 5 $/mois inclus.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleActivatePayPal} disabled={!!enrollingSubscriptionId}>
                {enrollingSubscriptionId
                  ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Redirection…</>
                  : <><ExternalLink className="h-3 w-3 mr-1" /> Activer avec PayPal</>}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    <PayPalAutoPayErrorDialog
      error={lastError}
      open={errorOpen}
      onClose={() => {
        setErrorOpen(false);
        clearLastError();
      }}
      onRetry={handleActivatePayPal}
      retrying={!!enrollingSubscriptionId}
    />
    </>
  );
};
