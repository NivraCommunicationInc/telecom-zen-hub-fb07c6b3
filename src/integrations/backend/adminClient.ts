// Dedicated backend client for ADMIN PORTAL only.
// Uses a distinct auth storage key so admin and employee sessions cannot cross-pollinate.

import { createClient } from "@supabase/supabase-js";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL;
const BACKEND_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

// CRITICAL: Different storage key than employee and client portal
const ADMIN_STORAGE_KEY = `sb-${PROJECT_ID}-staff-auth-token`;

export const adminClient = createClient(
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
