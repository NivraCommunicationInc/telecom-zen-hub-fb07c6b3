/**
 * useEmployeePinGate - Manages PIN-based account unlock for employees
 * 
 * Features:
 * - 10-minute unlock sessions per account
 * - 3 failed attempts = 15-minute lockout
 * - Full audit logging
 * - Session storage for active unlocks
 */

import { useState, useCallback, useEffect } from "react";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";
import { employeeClient as supabase } from "@/integrations/backend/employeeClient";
import { hashPin } from "@/lib/pinUtils";

interface UnlockedAccount {
  accountId: string;
  clientId: string;
  clientName: string;
  unlockedAt: number;
  expiresAt: number;
}

const UNLOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 3;
const STORAGE_KEY = "nivra_employee_unlocks";
const LOCKOUT_STORAGE_KEY = "nivra_employee_lockouts";

interface AccountLockout {
  accountId: string;
  lockedUntil: number;
  failedAttempts: number;
}

export const useEmployeePinGate = () => {
  const { user } = useEmployeeAuth();
  const [unlockedAccounts, setUnlockedAccounts] = useState<UnlockedAccount[]>([]);
  const [accountLockouts, setAccountLockouts] = useState<AccountLockout[]>([]);

  // Load from session storage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UnlockedAccount[];
        const now = Date.now();
        const valid = parsed.filter((ua) => ua.expiresAt > now);
        setUnlockedAccounts(valid);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      }

      const lockoutStored = sessionStorage.getItem(LOCKOUT_STORAGE_KEY);
      if (lockoutStored) {
        const parsed = JSON.parse(lockoutStored) as AccountLockout[];
        const now = Date.now();
        const valid = parsed.filter((l) => l.lockedUntil > now);
        setAccountLockouts(valid);
        sessionStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(valid));
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(LOCKOUT_STORAGE_KEY);
    }
  }, []);

  // Check if an account is currently unlocked
  const isAccountUnlocked = useCallback(
    (accountId: string): boolean => {
      const now = Date.now();
      return unlockedAccounts.some(
        (ua) => ua.accountId === accountId && ua.expiresAt > now
      );
    },
    [unlockedAccounts]
  );

  // Check if an account is locked out due to failed attempts
  const isAccountLockedOut = useCallback(
    (accountId: string): { locked: boolean; remainingMs: number; attempts: number } => {
      const now = Date.now();
      const lockout = accountLockouts.find(
        (l) => l.accountId === accountId && l.lockedUntil > now
      );
      if (lockout) {
        return {
          locked: true,
          remainingMs: lockout.lockedUntil - now,
          attempts: lockout.failedAttempts,
        };
      }
      // Check current failed attempts
      const currentLockout = accountLockouts.find((l) => l.accountId === accountId);
      return {
        locked: false,
        remainingMs: 0,
        attempts: currentLockout?.failedAttempts || 0,
      };
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

  // Log PIN attempt to database
  const logPinAttempt = async (
    accountId: string,
    clientId: string,
    clientName: string,
    result: "success" | "fail" | "lockout",
    failedCount: number
  ) => {
    if (!user) return;

    try {
      await supabase.from("employee_pin_attempts").insert({
        employee_id: user.id,
        employee_email: user.email,
        account_id: accountId,
        client_id: clientId,
        client_name: clientName,
        attempt_result: result,
        failed_count_at_attempt: failedCount,
      });
    } catch (error) {
      console.error("[useEmployeePinGate] Failed to log attempt:", error);
    }
  };

  // Verify PIN and unlock account
  const verifyAndUnlock = useCallback(
    async (
      accountId: string,
      clientId: string,
      clientName: string,
      enteredPin: string,
      reason: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "Non authentifié" };
      }

      // Check lockout
      const lockoutStatus = isAccountLockedOut(accountId);
      if (lockoutStatus.locked) {
        const mins = Math.ceil(lockoutStatus.remainingMs / 60000);
        return {
          success: false,
          error: `Compte verrouillé. Réessayez dans ${mins} minute(s).`,
        };
      }

      try {
        // Get client's PIN hash from profiles
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("client_pin_hash")
          .eq("user_id", clientId)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profile?.client_pin_hash) {
          return { success: false, error: "Ce client n'a pas configuré de NIP." };
        }

        // Hash the entered PIN and compare
        const enteredHash = await hashPin(enteredPin);
        const isValid = enteredHash === profile.client_pin_hash;

        if (isValid) {
          // Success - create unlock session
          const now = Date.now();
          const expiresAt = now + UNLOCK_DURATION_MS;

          const newUnlock: UnlockedAccount = {
            accountId,
            clientId,
            clientName,
            unlockedAt: now,
            expiresAt,
          };

          setUnlockedAccounts((prev) => {
            const filtered = prev.filter((ua) => ua.accountId !== accountId);
            const updated = [...filtered, newUnlock];
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
          });

          // Clear failed attempts
          setAccountLockouts((prev) => {
            const updated = prev.filter((l) => l.accountId !== accountId);
            sessionStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(updated));
            return updated;
          });

          // Log to database
          await logPinAttempt(accountId, clientId, clientName, "success", 0);

          // Create unlock record in DB
          await supabase.from("employee_pin_unlocks").insert({
            employee_id: user.id,
            employee_email: user.email,
            account_id: accountId,
            client_id: clientId,
            client_name: clientName,
            expires_at: new Date(expiresAt).toISOString(),
            unlock_reason: reason,
            is_active: true,
          });

          return { success: true };
        } else {
          // Failed attempt
          const currentAttempts = lockoutStatus.attempts + 1;

          if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
            // Lock out
            const lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
            setAccountLockouts((prev) => {
              const filtered = prev.filter((l) => l.accountId !== accountId);
              const updated = [
                ...filtered,
                { accountId, lockedUntil, failedAttempts: currentAttempts },
              ];
              sessionStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(updated));
              return updated;
            });

            await logPinAttempt(accountId, clientId, clientName, "lockout", currentAttempts);

            return {
              success: false,
              error: `Trop de tentatives. Compte verrouillé pour 15 minutes.`,
            };
          } else {
            // Update failed attempts
            setAccountLockouts((prev) => {
              const filtered = prev.filter((l) => l.accountId !== accountId);
              const updated = [
                ...filtered,
                {
                  accountId,
                  lockedUntil: 0,
                  failedAttempts: currentAttempts,
                },
              ];
              sessionStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(updated));
              return updated;
            });

            await logPinAttempt(accountId, clientId, clientName, "fail", currentAttempts);

            return {
              success: false,
              error: `NIP incorrect. ${MAX_FAILED_ATTEMPTS - currentAttempts} tentative(s) restante(s).`,
            };
          }
        }
      } catch (error) {
        console.error("[useEmployeePinGate] Error verifying PIN:", error);
        return { success: false, error: "Erreur lors de la vérification" };
      }
    },
    [user, isAccountLockedOut]
  );

  // Manually revoke an unlock
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
    sessionStorage.removeItem(LOCKOUT_STORAGE_KEY);
  }, []);

  return {
    isAccountUnlocked,
    isAccountLockedOut,
    getUnlockTimeRemaining,
    verifyAndUnlock,
    revokeUnlock,
    clearAllUnlocks,
    unlockedAccounts,
  };
};
