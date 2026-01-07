// Dedicated Supabase client for EMPLOYEE PORTAL only.
// Uses a distinct auth storage key so admin and employee sessions cannot cross-pollinate.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

// CRITICAL: Different storage key than admin (sb-{PROJECT_ID}-staff-auth-token) and client portal (portal-auth-token)
// This ensures employee sessions are completely isolated from admin sessions
const EMPLOYEE_STORAGE_KEY = `sb-${PROJECT_ID}-employee-auth-token`;

export const employeeClient = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storageKey: EMPLOYEE_STORAGE_KEY,
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// Alias for backward compatibility during migration
export const employeeSupabase = employeeClient;
