// Dedicated backend client for ADMIN PORTAL only.
// Uses a distinct auth storage key so admin and employee sessions cannot cross-pollinate.
// INCLUDES: OTP kill switch to prevent any OTP calls from admin portal.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL;
const BACKEND_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

// CRITICAL: Different storage key than employee and client portal
const ADMIN_STORAGE_KEY = `sb-${PROJECT_ID}-staff-auth-token`;

// ============================================================================
// OTP KILL SWITCH - BLOCKS ALL OTP CALLS FROM ADMIN PORTAL
// ============================================================================
// This ensures admin portal NEVER calls any OTP-related functions.
// Admin authentication uses SECRET CODE only (not email OTP).
// ============================================================================

const OTP_FUNCTION_PATTERN = /otp/i;

/**
 * Wrapper that blocks OTP function calls for admin portal.
 * Throws an error if any function containing "otp" is invoked.
 */
function createOtpBlockingClient(): SupabaseClient {
  const baseClient = createClient(
    BACKEND_URL,
    BACKEND_PUBLISHABLE_KEY,
    {
      auth: {
        storageKey: ADMIN_STORAGE_KEY,
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );

  // Override functions.invoke to block OTP calls
  const originalInvoke = baseClient.functions.invoke.bind(baseClient.functions);
  
  baseClient.functions.invoke = async (functionName: string, options?: any) => {
    // SECURITY: Block any OTP function calls from admin portal
    if (OTP_FUNCTION_PATTERN.test(functionName)) {
      console.error(`[ADMIN-CLIENT] ❌ OTP KILL SWITCH TRIGGERED`);
      console.error(`[ADMIN-CLIENT] Blocked function: ${functionName}`);
      console.error(`[ADMIN-CLIENT] Admin portal must use SECRET CODE only!`);
      console.trace("[ADMIN-CLIENT] Call stack:");
      
      throw new Error(
        `SECURITY: OTP functions are disabled for admin portal. ` +
        `Function "${functionName}" was blocked. ` +
        `Admin authentication uses SECRET CODE (admin-secret-verify), not email OTP.`
      );
    }
    
    return originalInvoke(functionName, options);
  };

  return baseClient;
}

export const adminClient = createOtpBlockingClient();

// Log that OTP kill switch is active
console.log("[ADMIN-CLIENT] 🔒 OTP Kill Switch ACTIVE - All *otp* functions blocked");
console.log("[ADMIN-CLIENT] ✓ Admin auth uses SECRET CODE only (admin-secret-verify)");
