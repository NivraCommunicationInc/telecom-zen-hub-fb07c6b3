-- Fix: Drop unique constraint on public_token (all values are "REDACTED" since we use hash)
ALTER TABLE public.identity_verification_sessions 
  DROP CONSTRAINT IF EXISTS identity_verification_sessions_public_token_key;

-- Make public_token nullable and default to null (no more "REDACTED" needed)
ALTER TABLE public.identity_verification_sessions 
  ALTER COLUMN public_token DROP NOT NULL,
  ALTER COLUMN public_token SET DEFAULT NULL;

-- Add document_type enum for OCR matching feature
DO $$ BEGIN
  CREATE TYPE public.id_document_type AS ENUM (
    'drivers_license', 'health_card', 'pr_card', 'passport_ca', 'passport_intl'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add OCR/match columns to sessions
ALTER TABLE public.identity_verification_sessions
  ADD COLUMN IF NOT EXISTS document_type public.id_document_type,
  ADD COLUMN IF NOT EXISTS extracted_fields jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS match_result jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checkout_fields jsonb DEFAULT NULL;

-- Clear the problematic "REDACTED" values from existing rows
UPDATE public.identity_verification_sessions SET public_token = NULL WHERE public_token = 'REDACTED';