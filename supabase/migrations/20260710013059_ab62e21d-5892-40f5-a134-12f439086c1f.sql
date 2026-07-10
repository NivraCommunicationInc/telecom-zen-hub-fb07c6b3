ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_source_chk;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_source_chk
  CHECK (source = ANY (ARRAY['email'::text, 'web'::text, 'phone'::text, 'equipment_return_request'::text, 'system'::text, 'core'::text, 'portal'::text]));