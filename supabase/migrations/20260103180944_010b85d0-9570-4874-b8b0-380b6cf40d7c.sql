-- Add new columns to employees table for HR/IT features
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS badge_number text UNIQUE,
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS pin_set_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS require_pin_change boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS internal_note text;

-- Create index on badge_number for fast lookup
CREATE INDEX IF NOT EXISTS idx_employees_badge_number ON public.employees(badge_number) WHERE badge_number IS NOT NULL;