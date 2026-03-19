/**
 * useStepUpAuth — Hook to gate sensitive actions behind step-up re-authentication.
 * 
 * Usage:
 *   const { requireStepUp, StepUpDialog } = useStepUpAuth();
 * 
 *   const handleRefund = () => {
 *     requireStepUp("refund", () => {
 *       // This only runs after successful re-auth
 *       performRefund();
 *     });
 *   };
 * 
 *   return <>{StepUpDialog}<button onClick={handleRefund}>Refund</button></>
 */
import { useState, useCallback, useMemo } from "react";
import { hasValidStepUp, type SensitiveAction } from "@/lib/security/stepUpAuth";
import StepUpAuthDialog from "@/components/security/StepUpAuthDialog";

export function useStepUpAuth() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<SensitiveAction | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | undefined>();
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  const requireStepUp = useCallback(
    async (action: SensitiveAction, callback: () => void, label?: string) => {
      // Check if we already have a valid step-up session
      const valid = await hasValidStepUp();
      if (valid) {
        callback();
        return;
      }

      // Need re-auth
      setPendingAction(action);
      setPendingLabel(label);
      setPendingCallback(() => callback);
      setDialogOpen(true);
    },
    []
  );

  const handleVerified = useCallback(() => {
    if (pendingCallback) {
      pendingCallback();
    }
    setPendingAction(null);
    setPendingCallback(null);
    setPendingLabel(undefined);
  }, [pendingCallback]);

  const StepUpDialog = useMemo(() => {
    if (!pendingAction) return null;
    return (
      <StepUpAuthDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={pendingAction}
        actionLabel={pendingLabel}
        onVerified={handleVerified}
      />
    );
  }, [dialogOpen, pendingAction, pendingLabel, handleVerified]);

  return { requireStepUp, StepUpDialog };
}
