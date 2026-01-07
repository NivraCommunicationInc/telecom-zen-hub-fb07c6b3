/**
 * useEmployeePinGate - Manages PIN-based account unlock for employees
 * 
 * SECURITY: All verification is done server-side via edge function.
 * Client-side state is only a cache for UX; server is source of truth.
 * 
 * Features:
 * - 10-minute unlock sessions per account (server-enforced)
 * - 3 failed attempts = 15-minute lockout (server-enforced)
 * - Full audit logging (server-side)
 * - Session storage only caches unlock status for UX
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";
import { employeeClient as supabase } from "@/integrations/backend/employeeClient";

interface UnlockedAccount {
  accountId: string;
  clientId: string;
  clientName: string;
  expiresAt: number;
}

interface LockoutInfo {
  accountId: string;
  lockedUntil: number;
}

const STORAGE_KEY = "nivra_employee_unlocks_cache";
const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-operations`;

export const useEmployeePinGate = () => {
  const { session } = useEmployeeAuth();
  const [unlockedAccounts, setUnlockedAccounts] = useState<UnlockedAccount[]>([]);
  const [accountLockouts, setAccountLockouts] = useState<LockoutInfo[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const checkingRef = useRef<Set<string>>(new Set());

  // Load cached unlocks from session storage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UnlockedAccount[];
        const now = Date.now();
        const valid = parsed.filter((ua) => ua.expiresAt > now);
        setUnlockedAccounts(valid);
        if (valid.length !== parsed.length) {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Helper to call backend function
  const callBackend = useCallback(async (action: string, body: any) => {
    if (!session?.access_token) {
      throw new Error("Non authentifié");
    }

    const hasApiKey = !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    console.log("[employee-ops] apikey present:", hasApiKey);

    const response = await fetch(`${EDGE_FUNCTION_URL}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        // Required by backend function gateway
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.success === false) {
      throw new Error(data?.error || "Erreur serveur");
    }

    return data;
  }, [session?.access_token]);

  // Check if an account is currently unlocked (from cache, verified by server)
  const isAccountUnlocked = useCallback(
    (accountId: string): boolean => {
      const now = Date.now();
      return unlockedAccounts.some(
        (ua) => ua.accountId === accountId && ua.expiresAt > now
      );
    },
    [unlockedAccounts]
  );

  // Check unlock status from server
  const checkUnlockStatus = useCallback(
    async (accountId: string): Promise<{ unlocked: boolean; locked: boolean; remainingMs: number }> => {
      // Prevent duplicate concurrent checks
      if (checkingRef.current.has(accountId)) {
        const cached = unlockedAccounts.find(ua => ua.accountId === accountId);
        if (cached && cached.expiresAt > Date.now()) {
          return { unlocked: true, locked: false, remainingMs: cached.expiresAt - Date.now() };
        }
        return { unlocked: false, locked: false, remainingMs: 0 };
      }

      checkingRef.current.add(accountId);

      try {
        const result = await callBackend("check-unlock", { accountId });
        
        if (result.unlocked) {
          const expiresAt = new Date(result.expiresAt).getTime();
          // Update cache
          setUnlockedAccounts(prev => {
            const filtered = prev.filter(ua => ua.accountId !== accountId);
            const updated = [...filtered, {
              accountId,
              clientId: "",
              clientName: result.clientName || "",
              expiresAt,
            }];
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
          });
          return { unlocked: true, locked: false, remainingMs: result.remainingMs };
        }

        if (result.locked) {
          const lockedUntil = new Date(result.lockoutExpiresAt).getTime();
          setAccountLockouts(prev => {
            const filtered = prev.filter(l => l.accountId !== accountId);
            return [...filtered, { accountId, lockedUntil }];
          });
          return { unlocked: false, locked: true, remainingMs: result.remainingMs };
        }

        return { unlocked: false, locked: false, remainingMs: 0 };
      } catch (error) {
        console.error("[useEmployeePinGate] Check unlock error:", error);
        return { unlocked: false, locked: false, remainingMs: 0 };
      } finally {
        checkingRef.current.delete(accountId);
      }
    },
    [callEdgeFunction, unlockedAccounts]
  );

  // Check if an account is locked out
  const isAccountLockedOut = useCallback(
    (accountId: string): { locked: boolean; remainingMs: number } => {
      const now = Date.now();
      const lockout = accountLockouts.find(
        (l) => l.accountId === accountId && l.lockedUntil > now
      );
      if (lockout) {
        return { locked: true, remainingMs: lockout.lockedUntil - now };
      }
      return { locked: false, remainingMs: 0 };
    },
    [accountLockouts]
  );

  // Get unlock time remaining for an account
  const getUnlockTimeRemaining = useCallback(
    (accountId: string): number => {
      const entry = unlockedAccounts.find((ua) => ua.accountId === accountId);
      if (!entry) return 0;
      return Math.max(0, entry.expiresAt - Date.now());
    },
    [unlockedAccounts]
  );

  // Verify PIN and unlock account (server-side)
  const verifyAndUnlock = useCallback(
    async (
      accountId: string,
      clientId: string,
      clientName: string,
      enteredPin: string,
      reason: string
    ): Promise<{ success: boolean; error?: string; locked?: boolean; lockoutExpiresAt?: string }> => {
      if (!session) {
        return { success: false, error: "Non authentifié" };
      }

      // Validate PIN format client-side first (6 digits)
      if (!/^\d{6}$/.test(enteredPin)) {
        return { success: false, error: "Le NIP doit contenir exactement 6 chiffres" };
      }

      // Check client-side lockout cache first
      const lockoutStatus = isAccountLockedOut(accountId);
      if (lockoutStatus.locked) {
        const mins = Math.ceil(lockoutStatus.remainingMs / 60000);
        return {
          success: false,
          error: `Compte verrouillé. Réessayez dans ${mins} minute(s).`,
          locked: true,
        };
      }

      setIsVerifying(true);

      try {
        const result = await callEdgeFunction("pin-verify-unlock", {
          accountId,
          clientId,
          pin: enteredPin,
          reason,
        });

        if (result.success) {
          // Update local cache
          const expiresAt = new Date(result.expiresAt).getTime();
          setUnlockedAccounts(prev => {
            const filtered = prev.filter(ua => ua.accountId !== accountId);
            const updated = [...filtered, {
              accountId,
              clientId,
              clientName: result.clientName || clientName,
              expiresAt,
            }];
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
          });

          // Clear any lockout cache
          setAccountLockouts(prev => prev.filter(l => l.accountId !== accountId));

          return { success: true };
        }

        // Handle lockout
        if (result.locked) {
          const lockedUntil = new Date(result.lockoutExpiresAt).getTime();
          setAccountLockouts(prev => {
            const filtered = prev.filter(l => l.accountId !== accountId);
            return [...filtered, { accountId, lockedUntil }];
          });
          return {
            success: false,
            error: result.error,
            locked: true,
            lockoutExpiresAt: result.lockoutExpiresAt,
          };
        }

        return { success: false, error: result.error };
      } catch (error: any) {
        console.error("[useEmployeePinGate] Verify error:", error);
        return { success: false, error: error.message || "Erreur lors de la vérification" };
      } finally {
        setIsVerifying(false);
      }
    },
    [session, isAccountLockedOut, callEdgeFunction]
  );

  // Manually revoke an unlock (client-side cache only)
  const revokeUnlock = useCallback((accountId: string) => {
    setUnlockedAccounts((prev) => {
      const updated = prev.filter((ua) => ua.accountId !== accountId);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear all unlocks (e.g., on logout)
  const clearAllUnlocks = useCallback(() => {
    setUnlockedAccounts([]);
    setAccountLockouts([]);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    isAccountUnlocked,
    isAccountLockedOut,
    getUnlockTimeRemaining,
    verifyAndUnlock,
    checkUnlockStatus,
    revokeUnlock,
    clearAllUnlocks,
    unlockedAccounts,
    isVerifying,
  };
};
