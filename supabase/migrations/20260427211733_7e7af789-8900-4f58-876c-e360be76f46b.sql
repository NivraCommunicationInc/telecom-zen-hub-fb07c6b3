ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS cc_user_ids uuid[] DEFAULT '{}'::uuid[];
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;
ALTER TABLE public.support_tickets ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.support_tickets ALTER COLUMN owner_user_id DROP NOT NULL;