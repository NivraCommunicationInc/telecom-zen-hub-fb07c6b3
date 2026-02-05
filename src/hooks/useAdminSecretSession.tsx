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

  // Verify session with backend
  const verifySession = useCallback(async (): Promise<boolean> => {
    const stored = getStoredSession();

    if (!stored) {
      setIsValidSession(false);
      setIsChecking(false);
      return false;
    }

    // Default to local validity (token exists + not expired) and only hard-fail if backend confirms invalid.
    try {
      setIsChecking(true);
      console.log("[useAdminSecretSession] Verifying session with backend...");

      // Ensure auth session is hydrated before invoking protected functions.
      // If auth isn't ready yet (route remount), don't nuke the secret session.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn("[useAdminSecretSession] No auth session yet; accepting local secret session and will re-check later");
        setSessionExpiresAt(new Date(stored.expiresAt));
        setIsValidSession(true);
        return true;
      }

      const { data, error } = await supabase.functions.invoke("admin-session-check", {
        body: {
          admin_user_id: stored.adminUserId,
          session_token: stored.token,
        },
      });

      if (error) {
        // Network/CORS/temporary backend errors must NOT log the admin out.
        console.error("[useAdminSecretSession] Session check error (soft):", error);
        setSessionExpiresAt(new Date(stored.expiresAt));
        setIsValidSession(true);
        return true;
      }

      if (!data?.valid) {
        console.log("[useAdminSecretSession] Session invalid (backend confirmed)");
        clearSession();
        return false;
      }

      console.log("[useAdminSecretSession] Session valid, expires at:", data.expires_at);
      setSessionExpiresAt(new Date(data.expires_at || stored.expiresAt));
      setIsValidSession(true);
      return true;
    } catch (err) {
      // Same rule: never clear on unexpected errors; keep local session and retry later.
      console.error("[useAdminSecretSession] Verify error (soft):", err);
      setSessionExpiresAt(new Date(stored.expiresAt));
      setIsValidSession(true);
      return true;
    } finally {
      setIsChecking(false);
    }
  }, [getStoredSession, clearSession]);

  // Check session on mount
  useEffect(() => {
    verifySession();
  }, [verifySession]);

  // Re-check when auth session becomes available (prevents /admin/login -> /admin remount race)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearSession();
        return;
      }

      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        setTimeout(() => {
          verifySession();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [verifySession, clearSession]);

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
