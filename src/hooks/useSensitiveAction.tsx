import { useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { verifySensitiveActionAllowed } from "@/lib/securityUtils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface UseSensitiveActionOptions {
  redirectOnBlock?: boolean;
  showToast?: boolean;
}

export const useSensitiveAction = (options: UseSensitiveActionOptions = {}) => {
  const { redirectOnBlock = true, showToast = true } = options;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(false);

  /**
   * Verify that the current user is allowed to perform a sensitive action.
   * If blocked, optionally shows a toast and redirects to the suspended page.
   * Returns true if allowed, false if blocked.
   */
  const verifySensitiveAction = useCallback(async (): Promise<boolean> => {
    if (!user) {
      if (showToast) {
        toast.error("Vous devez être connecté pour effectuer cette action.");
      }
      return false;
    }

    setIsChecking(true);
    try {
      const { allowed, reason } = await verifySensitiveActionAllowed(user.id);

      if (!allowed) {
        if (showToast && reason) {
          toast.error(reason);
        }
        if (redirectOnBlock) {
          navigate("/portal/suspended", { replace: true });
        }
        return false;
      }

      return true;
    } catch (err) {
      console.error("Error verifying sensitive action:", err);
      // On error, allow the action but log it
      return true;
    } finally {
      setIsChecking(false);
    }
  }, [user, showToast, redirectOnBlock, navigate]);

  /**
   * Wrapper that executes an action only if security check passes.
   * Use this to wrap any sensitive action callback.
   */
  const withSecurityCheck = useCallback(
    <T extends (...args: any[]) => Promise<any>>(action: T) => {
      return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
        const allowed = await verifySensitiveAction();
        if (!allowed) {
          return undefined;
        }
        return action(...args);
      };
    },
    [verifySensitiveAction]
  );

  return {
    verifySensitiveAction,
    withSecurityCheck,
    isChecking,
  };
};

export default useSensitiveAction;
