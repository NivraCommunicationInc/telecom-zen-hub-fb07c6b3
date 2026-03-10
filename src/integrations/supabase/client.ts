/**
 * Supabase client re-export.
 * The real client lives in @/integrations/backend/client.ts (backendClient).
 * This module re-exports it as `supabase` so the 89+ files that import from
 * this path keep working without changes.
 */
export { backendClient as supabase } from "@/integrations/backend/client";
