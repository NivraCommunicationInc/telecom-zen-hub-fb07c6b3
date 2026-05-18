ALTER TABLE public.crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_has_contact;
ALTER TABLE public.crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_email_phone_check;
ALTER TABLE public.crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_check;