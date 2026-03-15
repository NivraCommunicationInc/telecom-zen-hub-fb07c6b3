-- Fix: operational_fees table and RLS (staff_users doesn't exist, use admin_users only)

CREATE TABLE IF NOT EXISTS public.operational_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_key text NOT NULL UNIQUE,
  label_fr text NOT NULL,
  label_en text,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  fee_type text NOT NULL DEFAULT 'one_time',
  category text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  applies_when jsonb DEFAULT '{}'::jsonb,
  display_order integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.operational_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage operational_fees" ON public.operational_fees
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Anyone can read active operational_fees" ON public.operational_fees
  FOR SELECT TO anon, authenticated
  USING (is_active = true);