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
import { Loader2, CheckCircle2, Wallet, ShieldCheck, ExternalLink, RefreshCw, FileText } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { useClientAuth } from "@/hooks/useClientAuth";
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
import { Link } from "react-router-dom";
import { useClientAutoPayEnrollment } from "@/hooks/useClientAutoPayEnrollment";
import { PayPalAutoPayErrorDialog } from "@/components/client/PayPalAutoPayErrorDialog";

export const ClientPaymentMethodCard = () => {
  const { user } = useClientAuth();
  const qc = useQueryClient();
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

  const { data: paypalSub, isLoading } = useQuery({
    queryKey: ["client-paypal-preauth", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: customer } = await portalSupabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!customer) return null;
      const { data } = await portalSupabase
        .from("billing_subscriptions")
        .select("id, plan_name, plan_price, status, paypal_subscription_id")
        .eq("customer_id", customer.id)
        .eq("status", "active")
        .not("paypal_subscription_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  const isPreAuth = !!paypalSub;

  const handleEnroll = async (attemptId?: string) => {
    // Always allow activation: pick any existing subscription as the binding target
    // (active, pending, or suspended). The hook falls back to eligibility.subscription_id
    // only if no explicit subscription is passed.
    const target = subscriptions?.[0] ?? null;
    const ok = await enrollInPayPal(target, attemptId);
    if (!ok) {
      setErrorOpen(true);
    }
    // If ok=true, the page redirects to PayPal so nothing to do.
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
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={isPreAuth ? "border-emerald-300 bg-emerald-50/40" : "border-border"}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="w-4 h-4" />
            Mode de paiement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isPreAuth ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Paiement pré-autorisé PayPal ✓
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-1.5 text-emerald-700">
                  <ShieldCheck className="w-4 h-4" />
                  Votre compte bénéficie d'un rabais de 5$/mois
                </p>
                <p className="text-muted-foreground">
                  Vos factures sont payées automatiquement à la date d'échéance.
                </p>
                <p className="text-xs text-muted-foreground font-mono pt-1">
                  Référence: …{String(paypalSub.paypal_subscription_id).slice(-8)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setConfirmOpen(true)}
                  disabled={cancelling}
                >
                  Retirer le pré-autorisé
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/portal/autopay-log">
                    <FileText className="w-3 h-3 mr-1" />
                    Journal
                  </Link>
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

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  className="bg-[#0070ba] hover:bg-[#005ea6] text-white gap-1"
                  onClick={() => void handleEnroll()}
                  disabled={!!enrollingSubscriptionId}
                >
                  {enrollingSubscriptionId ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ExternalLink className="w-3 h-3" />
                  )}
                  Activer le paiement pré-autorisé
                </Button>
                {lastError && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setErrorOpen(true)}
                    className="text-destructive border-destructive/50"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Voir l'erreur précédente
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/portal/autopay-log">
                    <FileText className="w-3 h-3 mr-1" />
                    Journal
                  </Link>
                </Button>
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
                onClick={(e) => {
                  e.preventDefault();
                  handleCancel();
                }}
                disabled={cancelling}
                className="bg-red-600 hover:bg-red-700"
              >
                {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
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
