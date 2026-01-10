import { useState, useEffect, useCallback } from "react";
import { adminClient as supabase } from "@/integrations/backend";

const OTP_SESSION_KEY = "nivra_admin_otp_session";
const OTP_SESSION_EXPIRES_KEY = "nivra_admin_otp_expires";

interface OTPSession {
  token: string;
  expiresAt: string;
  adminUserId: string;
}

export function useAdminOTPSession() {
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);

  // Get stored session from localStorage
  const getStoredSession = useCallback((): OTPSession | null => {
    try {
      const token = localStorage.getItem(OTP_SESSION_KEY);
      const expiresAt = localStorage.getItem(OTP_SESSION_EXPIRES_KEY);
      const adminUserId = localStorage.getItem("nivra_admin_user_id");
      
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
  const storeSession = useCallback((token: string, expiresAt: string, adminUserId: string) => {
    try {
      localStorage.setItem(OTP_SESSION_KEY, token);
      localStorage.setItem(OTP_SESSION_EXPIRES_KEY, expiresAt);
      localStorage.setItem("nivra_admin_user_id", adminUserId);
      setSessionExpiresAt(new Date(expiresAt));
      setIsValidSession(true);
      console.log("[useAdminOTPSession] Session stored, expires at:", expiresAt);
    } catch (err) {
      console.error("[useAdminOTPSession] Failed to store session:", err);
    }
  }, []);

  // Clear session from localStorage
  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(OTP_SESSION_KEY);
      localStorage.removeItem(OTP_SESSION_EXPIRES_KEY);
      localStorage.removeItem("nivra_admin_user_id");
      setIsValidSession(false);
      setSessionExpiresAt(null);
      console.log("[useAdminOTPSession] Session cleared");
    } catch (err) {
      console.error("[useAdminOTPSession] Failed to clear session:", err);
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

    try {
      console.log("[useAdminOTPSession] Verifying session with backend...");
      
      const { data, error } = await supabase.functions.invoke("admin-otp-session-check", {
        body: { 
          admin_user_id: stored.adminUserId, 
          session_token: stored.token 
        },
      });

      if (error) {
        console.error("[useAdminOTPSession] Session check error:", error);
        clearSession();
        return false;
      }

      if (!data?.valid) {
        console.log("[useAdminOTPSession] Session invalid");
        clearSession();
        return false;
      }

      console.log("[useAdminOTPSession] Session valid, expires at:", data.expires_at);
      setSessionExpiresAt(new Date(data.expires_at));
      setIsValidSession(true);
      return true;

    } catch (err) {
      console.error("[useAdminOTPSession] Verify error:", err);
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
    storeSession,
    clearSession,
    verifySession,
    getStoredSession,
  };
}

export default useAdminOTPSession;
