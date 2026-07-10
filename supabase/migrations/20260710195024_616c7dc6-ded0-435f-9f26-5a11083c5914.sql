-- Align consent_* enums with the canonical Loi 25 spec used by
-- consent-journal-action and ConsentJournalDialog.

-- Statuses
ALTER TYPE public.consent_status_enum ADD VALUE IF NOT EXISTS 'denied';
ALTER TYPE public.consent_status_enum ADD VALUE IF NOT EXISTS 'withdrawn';
ALTER TYPE public.consent_status_enum ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.consent_status_enum ADD VALUE IF NOT EXISTS 'pending';

-- Channels
ALTER TYPE public.consent_channel_enum ADD VALUE IF NOT EXISTS 'core';
ALTER TYPE public.consent_channel_enum ADD VALUE IF NOT EXISTS 'field';
ALTER TYPE public.consent_channel_enum ADD VALUE IF NOT EXISTS 'chatbot';
ALTER TYPE public.consent_channel_enum ADD VALUE IF NOT EXISTS 'public_form';
ALTER TYPE public.consent_channel_enum ADD VALUE IF NOT EXISTS 'other';

-- Types
ALTER TYPE public.consent_type_enum ADD VALUE IF NOT EXISTS 'marketing_phone';
ALTER TYPE public.consent_type_enum ADD VALUE IF NOT EXISTS 'data_processing';
ALTER TYPE public.consent_type_enum ADD VALUE IF NOT EXISTS 'data_sharing_partners';
ALTER TYPE public.consent_type_enum ADD VALUE IF NOT EXISTS 'cookies_analytics';
ALTER TYPE public.consent_type_enum ADD VALUE IF NOT EXISTS 'cookies_marketing';
ALTER TYPE public.consent_type_enum ADD VALUE IF NOT EXISTS 'credit_check';
ALTER TYPE public.consent_type_enum ADD VALUE IF NOT EXISTS 'identity_verification';
ALTER TYPE public.consent_type_enum ADD VALUE IF NOT EXISTS 'recording_calls';
ALTER TYPE public.consent_type_enum ADD VALUE IF NOT EXISTS 'biometrics';
ALTER TYPE public.consent_type_enum ADD VALUE IF NOT EXISTS 'other';