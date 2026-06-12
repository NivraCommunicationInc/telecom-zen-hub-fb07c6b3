-- Create tax_documents table for generate-tax-document-pdf edge function
CREATE TABLE IF NOT EXISTS public.tax_documents (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID        REFERENCES public.employee_records(id) ON DELETE CASCADE,
  user_id        UUID,
  document_type  TEXT        NOT NULL DEFAULT 't4',  -- 't4' | 'rl1'
  tax_year       INTEGER     NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'draft', -- draft | generated | sent
  pdf_url        TEXT,
  generated_at   TIMESTAMPTZ,
  issued_at      TIMESTAMPTZ,
  sent_at        TIMESTAMPTZ,
  created_by     UUID,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tax_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_tax_documents ON public.tax_documents
  USING (
    auth.jwt() ->> 'role' IN ('admin','supervisor','billing_admin')
    OR auth.uid() = user_id
  );

GRANT SELECT ON public.tax_documents TO anon, authenticated;
GRANT ALL    ON public.tax_documents TO service_role;
