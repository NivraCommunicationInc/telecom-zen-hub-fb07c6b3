/**
 * ClientPaymentMethodCard
 * Shows whether the client has an active PayPal pre-authorized payment.
 * - Eligibility decided server-side via check_autopay_eligibility RPC.
 * - "Activer" launches PayPal flow with full traceability.
 * - On failure, shows detailed error dialog with retry.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Wallet, ShieldCheck, ExternalLink, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useClientAutoPayEnrollment } from "@/hooks/useClientAutoPayEnrollment";
import { PayPalAutoPayErrorDialog } from "@/components/client/PayPalAutoPayErrorDialog";
import { useWriteGuard } from "@/hooks/useWriteGuard";

export const ClientPaymentMethodCard = () => {
  const { user } = useClientAuth();
  const qc = useQueryClient();
  const writeGuard = useWriteGuard();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const {
    enrollInPayPal,
    enrollingSubscriptionId,
    subscriptions,
    lastError,
    clearLastError,
  } = useClientAutoPayEnrollment();

  const { data: canonical, isLoading } = useCanonicalClientData(user?.id);
  const paypalSub = ((canonical?.subscriptions || []) as any[])
    .filter((s) => s.status === "active" && s.paypal_subscription_id)
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] || null;


  const isPreAuth = !!paypalSub;

  const handleEnroll = async (attemptId?: string) => {
    const target = subscriptions?.[0] ?? null;
    const ok = await enrollInPayPal(target, attemptId);
    if (!ok) {
      setErrorOpen(true);
    }
  };

  const handleRetry = async () => {
    const attemptId = lastError?.attempt_id || undefined;
    setErrorOpen(false);
    await handleEnroll(attemptId);
  };

  const handleCancel = async () => {
    if (!paypalSub) return;
    try {
      setCancelling(true);
      const { data, error } = await portalSupabase.functions.invoke("paypal-cancel-subscription", {
        body: {
          subscription_id: paypalSub.id,
          reason: "Client requested removal of auto-pay",
        },
      });
      if (error) throw new Error(error.message || "Erreur");
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Paiement pré-autorisé retiré");
      qc.invalidateQueries({ queryKey: ["client-paypal-preauth"] });
      qc.invalidateQueries({ queryKey: ["client-billing-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["client-autopay-eligibility"] });
      setConfirmOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de l'annulation");
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={isPreAuth ? "border-emerald-300 bg-emerald-50/40" : "border-border"}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            Mode de paiement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isPreAuth ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Paiement pré-autorisé PayPal ✓
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-1.5 text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  Votre compte bénéficie d'un rabais de 5$/mois
                </p>
                <p className="text-muted-foreground">
                  Vos factures sont payées automatiquement à la date d'échéance.
                </p>
                <p className="pt-1 font-mono text-xs text-muted-foreground">
                  Référence: …{String(paypalSub.paypal_subscription_id).slice(-8)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setConfirmOpen(true)}
                  disabled={cancelling || writeGuard.isReadOnly}
                  title={writeGuard.disabledReason}
                >
                  Retirer le pré-autorisé
                </Button>
              </div>
            </>
          ) : (
            <>
              <Badge variant="secondary">Paiement manuel</Badge>
              <p className="text-sm text-muted-foreground">
                Activez le paiement pré-autorisé PayPal pour ne jamais oublier une facture et bénéficier d'un rabais de
                5$/mois. Vous pourrez utiliser une carte de crédit, Visa Débit ou Mastercard Débit via PayPal — aucun
                compte PayPal requis.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1 bg-[#0070ba] text-white hover:bg-[#005ea6]"
                  onClick={() => void handleEnroll()}
                  disabled={!!enrollingSubscriptionId}
                >
                  {enrollingSubscriptionId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3 w-3" />
                  )}
                  Activer le paiement pré-autorisé
                </Button>
                {lastError && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setErrorOpen(true)}
                    className="border-destructive/50 text-destructive"
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Réessayer
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Retirer le paiement pré-autorisé ?</AlertDialogTitle>
              <AlertDialogDescription>
                Vos prochaines factures devront être payées manuellement. Le rabais de 5$/mois sera également retiré.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={writeGuard((e: Event) => {
                  e.preventDefault();
                  void handleCancel();
                })}
                disabled={cancelling || writeGuard.isReadOnly}
                title={writeGuard.disabledReason}
                className="bg-red-600 hover:bg-red-700"
              >
                {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmer le retrait
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>

      <PayPalAutoPayErrorDialog
        error={lastError}
        open={errorOpen}
        onClose={() => {
          setErrorOpen(false);
          clearLastError();
        }}
        onRetry={handleRetry}
        retrying={!!enrollingSubscriptionId}
      />
    </>
  );
};