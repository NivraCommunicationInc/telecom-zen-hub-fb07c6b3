-- Recreate qa_pdf_templates_runtime view to derive last_used_at from pdf_generation_logs
DROP VIEW IF EXISTS qa_pdf_templates_runtime;

CREATE OR REPLACE VIEW qa_pdf_templates_runtime 
WITH (security_invoker = on)
AS
SELECT 
  ptc.template_key,
  ptc.template_type,
  ptc.template_path,
  ptc.version,
  ptc.is_active,
  COALESCE(MAX(pgl.generated_at), ptc.last_used_at) as last_used_at,
  ptc.created_at,
  ptc.updated_at,
  COUNT(pgl.id) as generation_count
FROM pdf_template_config ptc
LEFT JOIN pdf_generation_logs pgl ON pgl.template_path = ptc.template_path
GROUP BY ptc.id, ptc.template_key, ptc.template_type, ptc.template_path, ptc.version, ptc.is_active, ptc.last_used_at, ptc.created_at, ptc.updated_at;

-- Grant access
GRANT SELECT ON qa_pdf_templates_runtime TO authenticated;
GRANT SELECT ON qa_pdf_templates_runtime TO anon;