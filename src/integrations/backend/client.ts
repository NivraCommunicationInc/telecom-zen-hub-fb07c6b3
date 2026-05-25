// Default backend client for public/general use
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL;
const BACKEND_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const OTP_FUNCTION_PATTERN = /otp/i;

function isAdminPath(): boolean {
  try {
    return typeof window !== "undefined" && window.location?.pathname?.startsWith("/admin");
  } catch {
    return false;
  }
}

function applyAdminOtpKillSwitch(client: SupabaseClient): SupabaseClient {
  // Block any function invoke containing "otp" from any code running under /admin/*
  const originalInvoke = client.functions.invoke.bind(client.functions);
  client.functions.invoke = async (functionName: string, options?: any) => {
    if (isAdminPath() && OTP_FUNCTION_PATTERN.test(functionName)) {
      console.error("[BACKEND-CLIENT] ❌ OTP KILL SWITCH TRIGGERED (admin path)");
      console.error(`[BACKEND-CLIENT] Blocked function: ${functionName}`);
      console.trace("[BACKEND-CLIENT] Call stack:");
      throw new Error(
        `SECURITY: OTP functions are disabled for /admin/* routes. Function "${functionName}" was blocked.`
      );
    }
    return originalInvoke(functionName, options);
  };

  // Block OTP-based auth methods if any code tries to use them under /admin/*
  const authAny = client.auth as any;

  if (typeof authAny.signInWithOtp === "function") {
    const original = authAny.signInWithOtp.bind(client.auth);
    authAny.signInWithOtp = async (...args: any[]) => {
      if (isAdminPath()) {
        console.error("[BACKEND-CLIENT] ❌ OTP AUTH BLOCKED (signInWithOtp) on /admin/*");
        console.trace("[BACKEND-CLIENT] Call stack:");
        throw new Error("SECURITY: signInWithOtp is disabled for /admin/* routes.");
      }
      return original(...args);
    };
  }

  if (typeof authAny.verifyOtp === "function") {
    const original = authAny.verifyOtp.bind(client.auth);
    authAny.verifyOtp = async (...args: any[]) => {
      if (isAdminPath()) {
        console.error("[BACKEND-CLIENT] ❌ OTP AUTH BLOCKED (verifyOtp) on /admin/*");
        console.trace("[BACKEND-CLIENT] Call stack:");
        throw new Error("SECURITY: verifyOtp is disabled for /admin/* routes.");
      }
      return original(...args);
    };
  }

  return client;
}

/**
 * Tab-isolated auth storage for staff impersonation.
 * When the URL contains `?staff_imp_isolated=1` OR sessionStorage already
 * holds the marker, the Supabase auth storage is sessionStorage (tab-scoped).
 * This guarantees the impersonated employee session lives ONLY in the new
 * tab and does NOT overwrite the Core admin's localStorage session in the
 * original tab — Shopify-style "View as" behavior.
 */
const STAFF_IMP_ISOLATED_KEY = "nivra_staff_imp_isolated";

function resolveAuthStorage(): Storage {
  if (typeof window === "undefined") return localStorage;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("staff_imp_isolated") === "1") {
      sessionStorage.setItem(STAFF_IMP_ISOLATED_KEY, "1");
    }
    if (sessionStorage.getItem(STAFF_IMP_ISOLATED_KEY) === "1") {
      return sessionStorage;
    }
  } catch { /* fall through */ }
  return localStorage;
}

export const backendClient = applyAdminOtpKillSwitch(
  createClient(BACKEND_URL, BACKEND_PUBLISHABLE_KEY, {
    auth: {
      storage: resolveAuthStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  })
);
