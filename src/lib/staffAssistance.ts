/**
 * Staff Assistance Mode — Admin can silently view a staff member's portal.
 * No emails, no notifications, no audit pings to the user. Stored locally.
 */

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

export function startStaffAssistance(s: StaffAssistanceSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

export function getStaffAssistance(): StaffAssistanceSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StaffAssistanceSession;
    if (!parsed?.staff_user_id) return null;
    return parsed;
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
