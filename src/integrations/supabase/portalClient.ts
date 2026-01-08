// Dedicated Supabase client for CLIENT PORTAL only.
// SECURITY: Uses InMemoryStorage - sessions are NOT persisted to localStorage/sessionStorage

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { inMemoryStorage, verifyNoStoredTokens } from "@/lib/inMemoryStorage";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const portalSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: inMemoryStorage,
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Verify no tokens leaked on initialization
if (typeof window !== 'undefined') {
  verifyNoStoredTokens();
}

// Re-export as 'supabase' for backward compatibility in client portal files
export const supabase = portalSupabase;
