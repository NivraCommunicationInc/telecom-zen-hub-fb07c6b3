// Dedicated backend client for EMPLOYEE PORTAL only.
// Uses a distinct auth storage key so admin and employee sessions cannot cross-pollinate.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL;
const BACKEND_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

// CRITICAL: Different storage key than admin and client portal
// This ensures employee sessions are completely isolated from admin sessions
const EMPLOYEE_STORAGE_KEY = `sb-${PROJECT_ID}-employee-auth-token`;

export const employeeClient = createClient<Database>(
  BACKEND_URL,
  BACKEND_PUBLISHABLE_KEY,
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
