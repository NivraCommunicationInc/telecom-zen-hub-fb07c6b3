/**
 * Step-Up Auth — Requires recent re-authentication for sensitive actions.
 * 
 * Sensitive actions:
 * - refund, credit_apply, billing_approval
 * - role_change, access_flag_change
 * - kyc_override, account_suspension
 * - mfa_reset, data_export
 */
import { supabase } from "@/integrations/supabase/client";

const STEP_UP_VALIDITY_MINUTES = 15;

/**
 * Check if the user has a valid (non-expired) step-up session.
 */
export async function hasValidStepUp(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const { data, error } = await supabase
      .from("step_up_sessions")
      .select("id, expires_at, revoked_at")
      .eq("user_id", session.user.id)
      .is("revoked_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a step-up session after successful re-authentication.
 */
export async function createStepUpSession(method: string = "password"): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const expiresAt = new Date(Date.now() + STEP_UP_VALIDITY_MINUTES * 60 * 1000).toISOString();

    const { error } = await supabase.from("step_up_sessions").insert({
      user_id: session.user.id,
      method,
      expires_at: expiresAt,
    });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Revoke all step-up sessions for the current user.
 */
export async function revokeStepUpSessions(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase
      .from("step_up_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", session.user.id)
      .is("revoked_at", null);
  } catch (err) {
    console.error("[StepUp] Revoke failed:", err);
  }
}

/**
 * Re-authenticate with password to create a step-up session.
 */
export async function stepUpWithPassword(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) return { success: false, error: "Session invalide." };

    // Verify password by signing in again
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password,
    });

    if (authError) {
      return { success: false, error: "Mot de passe incorrect." };
    }

    const created = await createStepUpSession("password");
    if (!created) return { success: false, error: "Erreur de session." };

    return { success: true };
  } catch {
    return { success: false, error: "Erreur de vérification." };
  }
}

/** The list of actions that require step-up verification */
export const SENSITIVE_ACTIONS = [
  "refund",
  "credit_apply",
  "billing_approval",
  "role_change",
  "access_flag_change",
  "kyc_override",
  "account_suspension",
  "mfa_reset",
  "data_export",
  "payment_void",
  "invoice_void",
  "subscription_cancel",
] as const;

export type SensitiveAction = typeof SENSITIVE_ACTIONS[number];
