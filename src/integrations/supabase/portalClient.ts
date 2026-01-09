// This file creates a dedicated Supabase client for the CLIENT PORTAL only.
// It uses a distinct auth storage key so admin and client sessions can coexist on the same domain.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

// Keep this stable across deployments; different from the default client storage key.
const PORTAL_STORAGE_KEY = `sb-${PROJECT_ID}-portal-auth-token`;

export const portalSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: PORTAL_STORAGE_KEY,
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Re-export as 'supabase' for backward compatibility in client portal files
// This allows gradual migration without having to change every import
export const supabase = portalSupabase;
