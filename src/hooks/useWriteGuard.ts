/**
 * useWriteGuard — Wraps client-portal write actions so they are blocked
 * when an admin is in "Mode assistance" (impersonation read-only mode).
 *
 * Usage:
 *   const guard = useWriteGuard();
 *   <Button onClick={guard(handlePay)} disabled={guard.isReadOnly}
 *           title={guard.disabledReason}>Payer</Button>
 */
import { useCallback } from "react";
import { toast } from "sonner";
import { useImpersonationContext } from "@/components/client/ImpersonationBanner";

export const READ_ONLY_TOOLTIP = "Désactivé en mode assistance";

export function useWriteGuard() {
  const { active } = useImpersonationContext();

  const guard = useCallback(
    <T extends (...args: any[]) => any>(action: T) =>
      ((...args: Parameters<T>) => {
        if (active) {
          toast.warning("Mode lecture seule — actions désactivées pendant l'assistance");
          return undefined as ReturnType<T>;
        }
        return action(...args);
      }) as T,
    [active],
  );

  return Object.assign(guard, {
    isReadOnly: active,
    disabledReason: active ? READ_ONLY_TOOLTIP : undefined,
  });
}
