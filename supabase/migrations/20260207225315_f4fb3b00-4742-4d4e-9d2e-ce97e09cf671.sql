-- ============================================================================
-- PDF GENERATION LOGS - Table d'audit append-only
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pdf_generation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_type TEXT NOT NULL,
  entity_id UUID NULL,
  template_path TEXT NOT NULL,
  template_version TEXT NOT NULL,
  engine_version TEXT NOT NULL DEFAULT 'V2.5',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID NULL,
  invoice_id UUID NULL,
  order_id UUID NULL,
  user_id UUID NULL,
  payment_provider TEXT NULL,
  provider_payment_id TEXT NULL,
  invoice_number TEXT NULL,
  order_number TEXT NULL,
  customer_email TEXT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT NULL
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_pdf_generation_logs_generated_at ON public.pdf_generation_logs(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdf_generation_logs_doc_type ON public.pdf_generation_logs(doc_type);
CREATE INDEX IF NOT EXISTS idx_pdf_generation_logs_invoice_id ON public.pdf_generation_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pdf_generation_logs_order_id ON public.pdf_generation_logs(order_id);

-- Revoke UPDATE et DELETE pour garantir append-only
REVOKE UPDATE, DELETE ON public.pdf_generation_logs FROM anon, authenticated;

-- RLS: Lecture seule pour les admins/staff (via admin_users)
ALTER TABLE public.pdf_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all pdf logs"
  ON public.pdf_generation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  );

CREATE POLICY "System can insert pdf logs"
  ON public.pdf_generation_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- RPC: Log PDF Generation (appelé par le moteur)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_pdf_generation(
  p_doc_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_template_path TEXT DEFAULT NULL,
  p_template_version TEXT DEFAULT 'V2.5',
  p_engine_version TEXT DEFAULT 'V2.5',
  p_invoice_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_payment_provider TEXT DEFAULT NULL,
  p_provider_payment_id TEXT DEFAULT NULL,
  p_invoice_number TEXT DEFAULT NULL,
  p_order_number TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.pdf_generation_logs (
    doc_type,
    entity_id,
    template_path,
    template_version,
    engine_version,
    invoice_id,
    order_id,
    user_id,
    payment_provider,
    provider_payment_id,
    invoice_number,
    order_number,
    customer_email,
    success,
    error_message,
    generated_by
  ) VALUES (
    p_doc_type,
    p_entity_id,
    COALESCE(p_template_path, 'unknown'),
    p_template_version,
    p_engine_version,
    p_invoice_id,
    p_order_id,
    p_user_id,
    p_payment_provider,
    p_provider_payment_id,
    p_invoice_number,
    p_order_number,
    p_customer_email,
    p_success,
    p_error_message,
    auth.uid()
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ============================================================================
-- RPC: Update Template Last Used At (fix le problème NULL)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_template_last_used_at(p_template_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pdf_template_config
  SET 
    last_used_at = now(),
    updated_at = now()
  WHERE template_key = p_template_key;
END;
$$;

-- ============================================================================
-- Vue: qa_pdf_templates_runtime (last_used_at depuis les logs)
-- ============================================================================

DROP VIEW IF EXISTS public.qa_pdf_templates_runtime;

CREATE VIEW public.qa_pdf_templates_runtime
WITH (security_invoker = on)
AS
SELECT 
  ptc.template_key,
  ptc.template_type,
  ptc.template_path,
  ptc.version,
  ptc.is_active,
  -- last_used_at = MAX(generated_at) depuis pdf_generation_logs (source de vérité)
  COALESCE(
    (SELECT MAX(pgl.generated_at) 
     FROM public.pdf_generation_logs pgl 
     WHERE pgl.template_path = ptc.template_path 
       AND pgl.success = true),
    ptc.last_used_at
  ) AS last_used_at,
  ptc.created_at,
  ptc.updated_at,
  -- Stats additionnelles
  (SELECT COUNT(*) FROM public.pdf_generation_logs pgl 
   WHERE pgl.template_path = ptc.template_path AND pgl.success = true) AS generation_count
FROM public.pdf_template_config ptc
ORDER BY ptc.is_active DESC, ptc.template_type;

-- ============================================================================
-- Vue: qa_pdf_generation_logs (50 dernières générations)
-- ============================================================================

CREATE OR REPLACE VIEW public.qa_pdf_generation_logs
WITH (security_invoker = on)
AS
SELECT 
  id,
  doc_type,
  template_path,
  template_version,
  engine_version,
  generated_at,
  invoice_number,
  order_number,
  customer_email,
  payment_provider,
  success,
  error_message
FROM public.pdf_generation_logs
ORDER BY generated_at DESC
LIMIT 50;

-- Grant access aux vues
GRANT SELECT ON public.qa_pdf_templates_runtime TO authenticated;
GRANT SELECT ON public.qa_pdf_generation_logs TO authenticated;
GRANT SELECT ON public.pdf_generation_logs TO authenticated;