import { useState, useEffect, useCallback } from "react";
import { adminClient as supabase } from "@/integrations/backend";

const SECRET_SESSION_KEY = "nivra_admin_secret_session";
const SECRET_SESSION_EXPIRES_KEY = "nivra_admin_secret_expires";
const ADMIN_USER_ID_KEY = "nivra_admin_user_id";

interface SecretSession {
  token: string;
  expiresAt: string;
  adminUserId: string;
}

export function useAdminSecretSession() {
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const [usingDefaultCode, setUsingDefaultCode] = useState(false);

  // Get stored session from localStorage
  const getStoredSession = useCallback((): SecretSession | null => {
    try {
      const token = localStorage.getItem(SECRET_SESSION_KEY);
      const expiresAt = localStorage.getItem(SECRET_SESSION_EXPIRES_KEY);
      const adminUserId = localStorage.getItem(ADMIN_USER_ID_KEY);
      
      if (!token || !expiresAt || !adminUserId) return null;
      
      // Check if expired locally first
      if (new Date(expiresAt) < new Date()) {
        clearSession();
        return null;
      }
      
      return { token, expiresAt, adminUserId };
    } catch {
      return null;
    }
  }, []);

  // Store session in localStorage
  const storeSession = useCallback((token: string, expiresAt: string, adminUserId: string, isDefaultCode: boolean = false) => {
    try {
      localStorage.setItem(SECRET_SESSION_KEY, token);
      localStorage.setItem(SECRET_SESSION_EXPIRES_KEY, expiresAt);
      localStorage.setItem(ADMIN_USER_ID_KEY, adminUserId);
      setSessionExpiresAt(new Date(expiresAt));
      setIsValidSession(true);
      setUsingDefaultCode(isDefaultCode);
      console.log("[useAdminSecretSession] Session stored, expires at:", expiresAt);
    } catch (err) {
      console.error("[useAdminSecretSession] Failed to store session:", err);
    }
  }, []);

  // Clear session from localStorage
  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(SECRET_SESSION_KEY);
      localStorage.removeItem(SECRET_SESSION_EXPIRES_KEY);
      localStorage.removeItem(ADMIN_USER_ID_KEY);
      setIsValidSession(false);
      setSessionExpiresAt(null);
      setUsingDefaultCode(false);
      console.log("[useAdminSecretSession] Session cleared");
    } catch (err) {
      console.error("[useAdminSecretSession] Failed to clear session:", err);
    }
  }, []);

  // Verify session with backend (using existing admin_otp_sessions table)
  const verifySession = useCallback(async (): Promise<boolean> => {
    const stored = getStoredSession();
    
    if (!stored) {
      setIsValidSession(false);
      setIsChecking(false);
      return false;
    }

    try {
      console.log("[useAdminSecretSession] Verifying session with backend...");
      
      // Use the existing otp-session-check endpoint since we're using the same sessions table
      const { data, error } = await supabase.functions.invoke("admin-otp-session-check", {
        body: { 
          admin_user_id: stored.adminUserId, 
          session_token: stored.token 
        },
      });

      if (error) {
        console.error("[useAdminSecretSession] Session check error:", error);
        clearSession();
        return false;
      }

      if (!data?.valid) {
        console.log("[useAdminSecretSession] Session invalid");
        clearSession();
        return false;
      }

      console.log("[useAdminSecretSession] Session valid, expires at:", data.expires_at);
      setSessionExpiresAt(new Date(data.expires_at));
      setIsValidSession(true);
      return true;

    } catch (err) {
      console.error("[useAdminSecretSession] Verify error:", err);
      clearSession();
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [getStoredSession, clearSession]);

  // Check session on mount
  useEffect(() => {
    verifySession();
  }, [verifySession]);

  // Periodically check session validity (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = getStoredSession();
      if (stored && new Date(stored.expiresAt) < new Date()) {
        clearSession();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [getStoredSession, clearSession]);

  return {
    isValidSession,
    isChecking,
    sessionExpiresAt,
    usingDefaultCode,
    storeSession,
    clearSession,
    verifySession,
    getStoredSession,
  };
}

export default useAdminSecretSession;
