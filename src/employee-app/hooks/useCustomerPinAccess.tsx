/**
 * Hook to manage customer PIN verification sessions for employee access.
 * Checks for active session, handles verification, and expiration.
 */
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PinAccessState {
  hasAccess: boolean;
  isChecking: boolean;
  expiresAt: string | null;
}

export function useCustomerPinAccess(customerId: string | undefined) {
  const [state, setState] = useState<PinAccessState>({
    hasAccess: false,
    isChecking: true,
    expiresAt: null,
  });
  const [showPinModal, setShowPinModal] = useState(false);

  // Check for existing valid session
  const checkSession = useCallback(async () => {
    if (!customerId) return;
    setState(s => ({ ...s, isChecking: true }));

    try {
      const { data, error } = await supabase.functions.invoke("employee-verify-customer-pin", {
        body: { action: "check-session", customer_id: customerId },
      });

      if (!error && data?.has_session) {
        setState({ hasAccess: true, isChecking: false, expiresAt: data.expires_at });

        // Auto-expire when session ends
        const expiresMs = new Date(data.expires_at).getTime() - Date.now();
        if (expiresMs > 0) {
          const timer = setTimeout(() => {
            setState({ hasAccess: false, isChecking: false, expiresAt: null });
          }, expiresMs);
          return () => clearTimeout(timer);
        }
      } else {
        setState({ hasAccess: false, isChecking: false, expiresAt: null });
      }
    } catch {
      setState({ hasAccess: false, isChecking: false, expiresAt: null });
    }
  }, [customerId]);

  useEffect(() => {
    const cleanup = checkSession();
    return () => { if (cleanup && typeof cleanup === 'object' && 'then' in cleanup) { cleanup.then(fn => fn?.()); } };
  }, [checkSession]);

  // Verify PIN and create session
  const verifyPin = useCallback(async (pin: string): Promise<{ ok: boolean; message: string; attempts_remaining?: number; locked?: boolean }> => {
    if (!customerId) return { ok: false, message: "Client introuvable" };

    try {
      const { data, error } = await supabase.functions.invoke("employee-verify-customer-pin", {
        body: { customer_id: customerId, pin },
      });

      if (error) return { ok: false, message: "Erreur de vérification" };

      if (data?.ok) {
        setState({ hasAccess: true, isChecking: false, expiresAt: data.expires_at });
        setShowPinModal(false);

        // Auto-expire
        const expiresMs = new Date(data.expires_at).getTime() - Date.now();
        if (expiresMs > 0) {
          setTimeout(() => {
            setState({ hasAccess: false, isChecking: false, expiresAt: null });
          }, expiresMs);
        }

        return { ok: true, message: "Accès accordé" };
      }

      return {
        ok: false,
        message: data?.message || "NIP incorrect",
        attempts_remaining: data?.attempts_remaining,
        locked: data?.locked,
      };
    } catch {
      return { ok: false, message: "Erreur réseau" };
    }
  }, [customerId]);

  const requestAccess = useCallback(() => {
    setShowPinModal(true);
  }, []);

  return {
    ...state,
    showPinModal,
    setShowPinModal,
    verifyPin,
    requestAccess,
    refreshSession: checkSession,
  };
}
