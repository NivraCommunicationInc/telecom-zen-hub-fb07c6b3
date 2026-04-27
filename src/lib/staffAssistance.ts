/**
 * Staff Assistance Mode — Admin can silently view a staff member's portal.
 * No emails, no notifications, no audit pings to the user. Stored locally.
 *
 * Banner only shows when:
 *  1) localStorage has a valid session
 *  2) admin_user_id !== current auth uid (i.e. someone else originated it)
 *  3) started_at is less than 8 hours ago
 * Otherwise the key is cleared.
 */

import { supabase } from "@/integrations/supabase/client";

export type StaffAssistanceRole = "field_sales" | "rh" | "technician" | "employee";

export interface StaffAssistanceSession {
  staff_user_id: string;
  staff_name: string;
  staff_email: string;
  staff_role: StaffAssistanceRole;
  admin_user_id: string;
  started_at: string;
}

const KEY = "staff_assistance_session";
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

export function startStaffAssistance(s: StaffAssistanceSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

/**
 * Synchronous read — returns the raw stored session if structurally valid
 * and not expired. Does NOT validate against the current auth user.
 * Use `resolveStaffAssistance()` for the full check.
 */
export function getStaffAssistance(): StaffAssistanceSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StaffAssistanceSession;
    if (!parsed?.staff_user_id || !parsed?.admin_user_id || !parsed?.started_at) {
      clearStaffAssistance();
      return null;
    }
    const startedAt = new Date(parsed.started_at).getTime();
    if (!Number.isFinite(startedAt) || Date.now() - startedAt > MAX_AGE_MS) {
      clearStaffAssistance();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Async resolver — returns the session only if all 3 conditions hold:
 *   1) valid + not expired
 *   2) admin_user_id !== current auth uid
 *   3) started_at < 8h ago (already enforced in getStaffAssistance)
 * Clears the localStorage key when any condition fails.
 */
export async function resolveStaffAssistance(): Promise<StaffAssistanceSession | null> {
  const stored = getStaffAssistance();
  if (!stored) return null;
  try {
    const { data } = await supabase.auth.getUser();
    const currentUid = data.user?.id;
    if (!currentUid || currentUid === stored.admin_user_id) {
      clearStaffAssistance();
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

export function clearStaffAssistance() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
