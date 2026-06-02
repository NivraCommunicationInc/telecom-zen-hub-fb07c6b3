-- Fix: add missing columns referenced by code but absent from migrations
-- Covers support_tickets, ticket_replies, appointments, email_queue

-- ── support_tickets ──────────────────────────────────────────────
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS account_id         uuid,
  ADD COLUMN IF NOT EXISTS source             text DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_role    text DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS client_name        text;

-- ── ticket_replies ────────────────────────────────────────────────
ALTER TABLE public.ticket_replies
  ADD COLUMN IF NOT EXISTS sender_role text NOT NULL DEFAULT 'client';

-- ── appointments ──────────────────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS created_by          uuid,
  ADD COLUMN IF NOT EXISTS duration_minutes    integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS service_type        text,
  ADD COLUMN IF NOT EXISTS service_address     text,
  ADD COLUMN IF NOT EXISTS service_city        text,
  ADD COLUMN IF NOT EXISTS service_postal_code text,
  ADD COLUMN IF NOT EXISTS client_phone        text,
  ADD COLUMN IF NOT EXISTS appointment_number  text,
  ADD COLUMN IF NOT EXISTS internal_notes      text,
  ADD COLUMN IF NOT EXISTS installation_method text DEFAULT 'auto';
