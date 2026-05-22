
SET session_replication_role = 'replica';

DELETE FROM public.email_queue
WHERE to_email ILIKE '%oldo%' OR to_email ILIKE '%lavaud%'
   OR subject ILIKE '%oldo%' OR subject ILIKE '%lavaud%' OR subject ILIKE '%monet%'
   OR template_vars::text ILIKE '%oldo%' OR template_vars::text ILIKE '%lavaud%' OR template_vars::text ILIKE '%monet%';

DELETE FROM public.activity_logs
WHERE actor_email ILIKE '%oldo%' OR actor_email ILIKE '%lavaud%'
   OR actor_name  ILIKE '%oldo%' OR actor_name  ILIKE '%lavaud%'
   OR details::text ILIKE '%oldo%' OR details::text ILIKE '%lavaud%' OR details::text ILIKE '%monet%';

DELETE FROM public.field_leads
WHERE email ILIKE '%oldo%' OR email ILIKE '%lavaud%'
   OR first_name ILIKE '%oldo%' OR last_name ILIKE '%lavaud%';

DELETE FROM public.crm_contacts
WHERE email ILIKE '%oldo%' OR email ILIKE '%lavaud%'
   OR address ILIKE '%monet%' OR service_address ILIKE '%monet%';

DELETE FROM public.accounts WHERE id = '8f7c5d15-4083-4728-89ba-18a2ed811434';

DELETE FROM public.contracts
WHERE user_id IN (
  'ee028941-f231-4e77-8379-4e4c13f62002','61251da1-e04d-4d96-959c-a9b9ce59d13e',
  '2da95525-539a-4f30-9ac2-d59fbf961ac1','abcb269f-4bb7-4679-85ff-b51c74a6d102'
);

DELETE FROM public.kyc_requests WHERE client_email ILIKE '%oldo%' OR client_email ILIKE '%lavaud%';
DELETE FROM public.client_login_pins WHERE email ILIKE '%oldo%' OR email ILIKE '%lavaud%';

UPDATE public.billing_customers
SET first_name='Compte', last_name='Anonymisé',
    email='anon-' || substr(id::text,1,8) || '@nivra-internal.local',
    phone='000-000-0000'
WHERE first_name ILIKE '%oldo%' OR last_name ILIKE '%lavaud%'
   OR email ILIKE '%oldo%' OR email ILIKE '%lavaud%';

UPDATE public.profiles
SET full_name='Compte Anonymisé',
    email='anon-' || substr(user_id::text,1,8) || '@nivra-internal.local'
WHERE user_id IN (
  'ee028941-f231-4e77-8379-4e4c13f62002','61251da1-e04d-4d96-959c-a9b9ce59d13e',
  '2da95525-539a-4f30-9ac2-d59fbf961ac1','abcb269f-4bb7-4679-85ff-b51c74a6d102'
);

UPDATE auth.users
SET email='anon-' || substr(id::text,1,8) || '@nivra-internal.local',
    raw_user_meta_data=jsonb_build_object('sub',id::text,'anonymized_at',now(),'anonymized_reason','PII purge'),
    phone=NULL
WHERE id IN (
  'ee028941-f231-4e77-8379-4e4c13f62002','61251da1-e04d-4d96-959c-a9b9ce59d13e',
  '2da95525-539a-4f30-9ac2-d59fbf961ac1','abcb269f-4bb7-4679-85ff-b51c74a6d102'
);

UPDATE auth.identities
SET identity_data = identity_data || jsonb_build_object('email','anon-' || substr(user_id::text,1,8) || '@nivra-internal.local')
WHERE user_id IN (
  'ee028941-f231-4e77-8379-4e4c13f62002','61251da1-e04d-4d96-959c-a9b9ce59d13e',
  '2da95525-539a-4f30-9ac2-d59fbf961ac1','abcb269f-4bb7-4679-85ff-b51c74a6d102'
);

SET session_replication_role = 'origin';
