/**
 * hrOnboardingGate — Shared check to block internal-portal access for staff
 * whose HR onboarding is NOT complete (no active employee_records row).
 *
 * Wraps the SECURITY DEFINER RPC `has_completed_hr_onboarding(uuid)`.
 * Admin role is always allowed through (sysadmins don't need an HR file).
 */
import { supabase } from "@/integrations/supabase/client";

export async function isHrOnboardingComplete(userId: string): Promise<boolean> {
  try {
    // Admins bypass — they manage HR, they aren't required to have an employee_records row
    const { data: adminCheck } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin" as any,
    });
    if (adminCheck === true) return true;

    const { data, error } = await supabase.rpc("has_completed_hr_onboarding", {
      _user_id: userId,
    });
    if (error) {
      console.warn("[hrOnboardingGate] RPC error:", error.message);
      return false;
    }
    return data === true;
  } catch (err: any) {
    console.warn("[hrOnboardingGate] unexpected error:", err?.message);
    return false;
  }
}
