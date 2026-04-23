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
...
              <div className="flex items-center gap-2 flex-wrap">
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
