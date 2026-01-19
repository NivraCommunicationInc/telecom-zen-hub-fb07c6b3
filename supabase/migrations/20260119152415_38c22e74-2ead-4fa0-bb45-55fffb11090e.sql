-- Fix SECURITY DEFINER view warning by using SECURITY INVOKER
-- Drop the view and recreate with proper security settings
DROP VIEW IF EXISTS public.referral_codes_public;

-- Recreate as a regular view (SECURITY INVOKER is the default in modern PostgreSQL)
-- But since this is meant to be public, we need a different approach

-- Instead of a view, let's just rely on the security definer function
-- which is properly secured with search_path = public

-- The function validate_referral_code already provides safe public access
-- No need for a public view that could expose data

-- Verify the referral_codes table no longer has public SELECT policy
-- (we dropped it in the previous migration)