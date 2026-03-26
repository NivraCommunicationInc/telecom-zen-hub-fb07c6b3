
-- CRM contacts / leads table — NOT auth users
CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  first_name text,
  last_name text,
  email text,
  phone text,
  source text NOT NULL DEFAULT 'csv_import',
  status text NOT NULL DEFAULT 'lead',
  tags text[] DEFAULT '{}',
  notes text,
  imported_by uuid,
  import_batch_id uuid,
  converted_to_user_id uuid,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_contacts_has_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX idx_crm_contacts_email ON public.crm_contacts (email) WHERE email IS NOT NULL;
CREATE INDEX idx_crm_contacts_phone ON public.crm_contacts (phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_crm_contacts_status ON public.crm_contacts (status);
CREATE INDEX idx_crm_contacts_import_batch ON public.crm_contacts (import_batch_id) WHERE import_batch_id IS NOT NULL;

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage crm_contacts"
  ON public.crm_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Update csv_import_logs to reference this layer
ALTER TABLE public.csv_import_logs ADD COLUMN IF NOT EXISTS target_table text NOT NULL DEFAULT 'crm_contacts';
