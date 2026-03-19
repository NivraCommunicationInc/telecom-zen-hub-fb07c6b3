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
    const verifiedFactor = totpFactors.find((f) => f.status === "verified");
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
    const unverifiedFactor = totpFactors.find((f) => f.status === "unverified");
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
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp) {
    for (const f of factors.totp) {
      if (f.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Nivra Internal Auth",
  });

  if (error) throw error;
  return data;
}

/**
 * Verify a TOTP code during enrollment (first-time) or login challenge.
 */
export async function verifyMfaCode(factorId: string, code: string): Promise<boolean> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });

  if (verifyError) return false;
  return true;
}
