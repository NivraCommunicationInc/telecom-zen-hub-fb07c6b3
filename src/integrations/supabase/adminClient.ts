// Dedicated Supabase client for ADMIN PORTAL only.
// SECURITY: Uses InMemoryStorage - sessions are NOT persisted to localStorage/sessionStorage

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { inMemoryStorage, verifyNoStoredTokens } from "@/lib/inMemoryStorage";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const adminClient = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: inMemoryStorage,
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Verify no tokens leaked on initialization
if (typeof window !== 'undefined') {
  verifyNoStoredTokens();
}

// Alias for backward compatibility during migration
export const adminSupabase = adminClient;
