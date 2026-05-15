/**
 * MFA Enforcement — Hooks and utilities for TOTP-based 2FA.
 * Uses Supabase Auth MFA (TOTP) for all internal staff accounts.
 */
import { supabase } from "@/integrations/supabase/client";

export interface MfaStatus {
  isEnrolled: boolean;
  isVerified: boolean;
  factorId: string | null;
}

/**
 * Check if the current user has MFA enrolled and verified in this session.
 */
export async function checkMfaStatus(): Promise<MfaStatus> {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) {
      return { isEnrolled: false, isVerified: false, factorId: null };
    }

    const totpFactors = data.totp ?? [];
    if (totpFactors.length === 0) {
      return { isEnrolled: false, isVerified: false, factorId: null };
    }

    // Check for verified factor
    const verifiedFactor = totpFactors.find((f) => f.factor_type === "totp" && f.status === "verified");
    if (verifiedFactor) {
      // Check AAL level — AAL2 means MFA was used in this session
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const isSessionVerified = aalData?.currentLevel === "aal2";

      return {
        isEnrolled: true,
        isVerified: isSessionVerified,
        factorId: verifiedFactor.id,
      };
    }

    // Has unverified factor (enrollment started but not completed)
    const unverifiedFactor = totpFactors.find((f) => f.factor_type === "totp" && f.status !== "verified");
    return {
      isEnrolled: false,
      isVerified: false,
      factorId: unverifiedFactor?.id ?? null,
    };
  } catch (err) {
    console.error("[MFA] Status check failed:", err);
    return { isEnrolled: false, isVerified: false, factorId: null };
  }
}

/**
 * Start MFA enrollment — returns QR code URI and secret.
 */
export async function enrollMfa() {
  // First unenroll any unverified factors to prevent duplicates
  const { data: existingFactors } = await supabase.auth.mfa.listFactors();
  if (existingFactors?.totp) {
    for (const f of existingFactors.totp) {
      if (f.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Nivra Hub Secure",
    friendlyName: "Nivra Hub Secure",
  });

  if (error) throw error;
  return data;
}

/**
 * Verify a TOTP code. Always issues a fresh challenge then verifies atomically
 * via challengeAndVerify so expired/reused challenge IDs are impossible.
 */
export async function verifyMfaCode(factorId: string, code: string): Promise<boolean> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    console.warn("[MFA] verify failed:", error.message);
    return false;
  }
  return true;
}
