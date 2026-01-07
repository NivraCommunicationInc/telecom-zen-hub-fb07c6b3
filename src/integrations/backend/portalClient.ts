// Dedicated backend client for CLIENT PORTAL only.
// Uses a distinct auth storage key so admin and client sessions can coexist on the same domain.

import { createClient } from "@supabase/supabase-js";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL;
const BACKEND_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

// Keep this stable across deployments; different from the default client storage key.
const PORTAL_STORAGE_KEY = `sb-${PROJECT_ID}-portal-auth-token`;

export const portalClient = createClient(BACKEND_URL, BACKEND_PUBLISHABLE_KEY, {
  auth: {
    storageKey: PORTAL_STORAGE_KEY,
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Aliases for backward compatibility
export const portalSupabase = portalClient;
export const supabase = portalClient;
