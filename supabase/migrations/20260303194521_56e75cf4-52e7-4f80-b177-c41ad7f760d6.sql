
-- STEP 1: Add public_token_hash column
ALTER TABLE public.identity_verification_sessions 
  ADD COLUMN IF NOT EXISTS public_token_hash text;

-- STEP 2: Create index on hash for lookups
CREATE INDEX IF NOT EXISTS idx_ivs_public_token_hash ON public.identity_verification_sessions(public_token_hash);

-- STEP 3: Create a function to hash tokens using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- STEP 4: Drop ALL overly permissive anon policies
DROP POLICY IF EXISTS "Anon can read by public_token" ON public.identity_verification_sessions;
DROP POLICY IF EXISTS "Anon can update for submission" ON public.identity_verification_sessions;
DROP POLICY IF EXISTS "Anyone can insert events" ON public.identity_verification_events;

-- STEP 5: Create SECURE anon policies - NO direct anon access at all
-- Anon should NEVER read sessions directly; all access through edge functions with service_role
-- Events: only service_role inserts (via edge functions)

-- STEP 6: Keep authenticated policies but tighten them
-- Users can only read their OWN sessions (already exists)
-- Users can only update their OWN sessions (already exists)
-- Admins can read/update all (already exists)

-- STEP 7: Tighten events - only authenticated users can insert their own events
CREATE POLICY "Authenticated can insert own events"
  ON public.identity_verification_events
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
