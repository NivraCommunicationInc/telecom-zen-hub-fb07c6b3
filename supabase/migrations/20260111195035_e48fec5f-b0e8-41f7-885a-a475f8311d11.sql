-- Add promo_code_snapshot column to contest_entries
ALTER TABLE public.contest_entries 
ADD COLUMN IF NOT EXISTS promo_code_snapshot text;

-- Create contest_winners table
CREATE TABLE IF NOT EXISTS public.contest_winners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_slug text NOT NULL,
  winner_user_id uuid NOT NULL,
  winner_entry_id uuid NOT NULL REFERENCES public.contest_entries(id),
  winner_name text,
  winner_email text,
  drawn_at timestamptz NOT NULL DEFAULT now(),
  drawn_by_admin_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce one winner per contest (unless overwritten)
CREATE UNIQUE INDEX IF NOT EXISTS contest_winners_slug_unique 
ON public.contest_winners(contest_slug);

-- Enable RLS
ALTER TABLE public.contest_winners ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for contest_winners
CREATE POLICY "Admin can view all contest winners"
ON public.contest_winners FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR
  EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Admin can insert contest winners"
ON public.contest_winners FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Admin can update contest winners"
ON public.contest_winners FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Admin can delete contest winners"
ON public.contest_winners FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Update the contest entry trigger function to check for BIENVENUE promo code
CREATE OR REPLACE FUNCTION public.handle_order_contest_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest_slug text := 'welcome-500-2026';
  v_final_statuses text[] := ARRAY['completed', 'installation_completed'];
  v_profile_record record;
  v_normalized_promo text;
BEGIN
  -- Only proceed if:
  -- 1. Status changed TO a final status (not already in final)
  -- 2. The order used promo code BIENVENUE
  
  -- Check if OLD.status was NOT a final status and NEW.status IS a final status
  IF NOT (OLD.status = ANY(v_final_statuses)) AND (NEW.status = ANY(v_final_statuses)) THEN
    
    -- Normalize promo code: uppercase, trim, remove trailing punctuation
    v_normalized_promo := UPPER(TRIM(REGEXP_REPLACE(COALESCE(NEW.promo_code, ''), '[.,;:!?]+$', '')));
    
    -- Only create entry if promo code is BIENVENUE
    IF v_normalized_promo = 'BIENVENUE' THEN
      -- Check if this is a new customer (no prior completed orders)
      IF public.is_new_customer(NEW.user_id, NEW.id) THEN
        -- Get profile info for snapshot
        SELECT full_name, email, phone INTO v_profile_record
        FROM public.profiles
        WHERE id = NEW.user_id;
        
        -- Insert contest entry (idempotent due to unique constraint)
        INSERT INTO public.contest_entries (
          contest_slug,
          user_id,
          order_id,
          full_name_snapshot,
          email_snapshot,
          phone_snapshot,
          promo_code_snapshot
        ) VALUES (
          v_contest_slug,
          NEW.user_id,
          NEW.id,
          v_profile_record.full_name,
          COALESCE(v_profile_record.email, NEW.email),
          v_profile_record.phone,
          v_normalized_promo
        )
        ON CONFLICT (contest_slug, user_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contest_entries_promo ON public.contest_entries(promo_code_snapshot);
CREATE INDEX IF NOT EXISTS idx_contest_entries_created_at ON public.contest_entries(created_at DESC);