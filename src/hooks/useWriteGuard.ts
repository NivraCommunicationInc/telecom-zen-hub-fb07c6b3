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

type AnyFn = (...args: any[]) => any;

export interface WriteGuard {
  (action: AnyFn): (...args: any[]) => any;
  isReadOnly: boolean;
  disabledReason: string | undefined;
}

export function useWriteGuard(): WriteGuard {
  const { active } = useImpersonationContext();

  const guardFn = useCallback(
    function guard(action: AnyFn) {
      return function guarded(...args: any[]) {
        if (active) {
          toast.warning("Mode lecture seule — actions désactivées pendant l'assistance");
          return undefined;
        }
        return action(...args);
      };
    },
    [active],
  );

  const wrapped = guardFn as WriteGuard;
  wrapped.isReadOnly = active;
  wrapped.disabledReason = active ? READ_ONLY_TOOLTIP : undefined;
  return wrapped;
}
