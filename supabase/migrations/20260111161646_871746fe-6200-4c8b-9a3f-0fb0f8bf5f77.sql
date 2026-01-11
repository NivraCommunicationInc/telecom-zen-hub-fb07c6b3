-- Add new columns to promotions table for "first-month-only" and "new customers only" promo features
ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS new_customers_only boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS duration text NOT NULL DEFAULT 'ongoing';

-- Add comment for duration column (values: 'ongoing', 'first_cycle_only')
COMMENT ON COLUMN public.promotions.duration IS 'Duration type: ongoing (forever), first_cycle_only (first billing cycle only)';

-- Create contest_entries table for tracking tirage/draw entries
CREATE TABLE public.contest_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_slug text NOT NULL,
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  email_snapshot text NOT NULL,
  phone_snapshot text,
  full_name_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contest_entries_user_contest_unique UNIQUE (contest_slug, user_id)
);

-- Enable RLS on contest_entries
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;

-- Admins can read all entries
CREATE POLICY "Admins can view all contest entries"
  ON public.contest_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  );

-- Admins can insert entries (for automated processes)
CREATE POLICY "Admins can insert contest entries"
  ON public.contest_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  );

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access on contest_entries"
  ON public.contest_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);