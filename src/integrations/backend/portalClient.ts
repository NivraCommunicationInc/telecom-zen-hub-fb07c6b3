// Dedicated backend client for CLIENT PORTAL only.
// SECURITY: Uses InMemoryStorage - sessions are NOT persisted to localStorage/sessionStorage

import { createClient } from "@supabase/supabase-js";
import { inMemoryStorage, verifyNoStoredTokens } from "@/lib/inMemoryStorage";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL;
const BACKEND_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const portalClient = createClient(BACKEND_URL, BACKEND_PUBLISHABLE_KEY, {
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
