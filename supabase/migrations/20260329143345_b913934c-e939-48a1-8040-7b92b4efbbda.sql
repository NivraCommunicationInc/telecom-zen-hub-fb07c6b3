-- Commission ↔ Payroll link table for traceability and double-payment prevention

CREATE TABLE public.payroll_commission_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id uuid NOT NULL REFERENCES payroll_entries(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL,
  commission_source text NOT NULL CHECK (commission_source IN ('sales', 'field')),
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commission_id, commission_source)
);

ALTER TABLE public.payroll_commission_links ENABLE ROW LEVEL SECURITY;

-- Employees can read their own links (via payroll_entries join)
CREATE POLICY "Users can read own commission links"
  ON public.payroll_commission_links
  FOR SELECT TO authenticated
  USING (
    payroll_entry_id IN (
      SELECT id FROM payroll_entries WHERE user_id = auth.uid()
    )
  );

-- Admins can manage
CREATE POLICY "Admins can manage commission links"
  ON public.payroll_commission_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: prevent linking a commission that's already linked to another payroll
CREATE OR REPLACE FUNCTION public.prevent_double_commission_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM payroll_commission_links
    WHERE commission_id = NEW.commission_id
      AND commission_source = NEW.commission_source
      AND payroll_entry_id != NEW.payroll_entry_id
  ) THEN
    RAISE EXCEPTION 'Commission % (%) déjà incluse dans une autre fiche de paie',
      NEW.commission_id, NEW.commission_source;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_double_commission_payment
  BEFORE INSERT OR UPDATE ON payroll_commission_links
  FOR EACH ROW
  EXECUTE FUNCTION prevent_double_commission_payment();