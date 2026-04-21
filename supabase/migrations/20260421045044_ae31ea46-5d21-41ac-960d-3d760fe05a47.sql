UPDATE public.pending_document_jobs
SET next_attempt_at = now() - interval '1 minute',
    last_error = NULL
WHERE id IN ('e43b4d6e-cb96-4b07-ba17-0bc5740183b3','c96ac599-dbd4-4b1c-99f3-869be6175d4f')
  AND status = 'pending';

INSERT INTO public.pending_document_jobs
  (account_id, client_id, doc_type, event_type, idempotency_key, recipient_email, event_payload, status, next_attempt_at, attempts, max_attempts)
VALUES
  (
    '900ec603-f263-4bf0-b049-2e6f42b21cf5',
    'cc9e952a-62d6-4b0c-bded-91f4b2d9ea8f',
    'welcome_letter',
    'account.created',
    'welcome_letter::test::nivratelecom::' || extract(epoch from now())::bigint,
    'nivratelecom@gmail.com',
    jsonb_build_object(
      'email','nivratelecom@gmail.com',
      'phone','(438) 792-3288',
      'first_name','Nivra',
      'last_name','Test',
      'full_name','Nivra Test Order',
      'account_number','200717',
      'service_name','Internet Fibre 1 Gbps',
      'monthly_amount', 75.00,
      'activation_date', now(),
      'service_address', jsonb_build_object('street','1799 Av. Pierre-Péladeau','city','Laval','province','QC','postal_code','H7T 2Y5'),
      'letter_number','BVN-' || to_char(now(),'YYYYMMDD') || '-NIVRA01'
    ),
    'pending', now() - interval '1 minute', 0, 5
  ),
  (
    '900ec603-f263-4bf0-b049-2e6f42b21cf5',
    'cc9e952a-62d6-4b0c-bded-91f4b2d9ea8f',
    'activation_confirmation',
    'service.activated',
    'activation::test::nivratelecom::' || extract(epoch from now())::bigint,
    'nivratelecom@gmail.com',
    jsonb_build_object(
      'email','nivratelecom@gmail.com',
      'full_name','Nivra Test Order',
      'account_number','200717',
      'service_name','Internet Fibre 1 Gbps',
      'activation_date', now(),
      'confirmation_number','ACT-' || to_char(now(),'YYYYMMDDHH24MI')
    ),
    'pending', now() - interval '1 minute', 0, 5
  ),
  (
    '900ec603-f263-4bf0-b049-2e6f42b21cf5',
    'cc9e952a-62d6-4b0c-bded-91f4b2d9ea8f',
    'service_certificate',
    'account.certificate_requested',
    'certificate::test::nivratelecom::' || extract(epoch from now())::bigint,
    'nivratelecom@gmail.com',
    jsonb_build_object(
      'email','nivratelecom@gmail.com',
      'full_name','Nivra Test Order',
      'account_number','200717',
      'service_name','Internet Fibre 1 Gbps',
      'active_since', (now() - interval '30 days')::text,
      'certificate_number','CRT-' || to_char(now(),'YYYYMMDDHH24MI')
    ),
    'pending', now() - interval '1 minute', 0, 5
  )
ON CONFLICT (idempotency_key) DO NOTHING;