ALTER TABLE public.client_internal_notes
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;

UPDATE public.client_internal_notes cin
SET account_id = a.id
FROM public.accounts a
WHERE cin.account_id IS NULL
  AND a.client_id = cin.client_id;

ALTER TABLE public.client_internal_notes
  DROP CONSTRAINT IF EXISTS client_internal_notes_note_type_check;

ALTER TABLE public.client_internal_notes
  ADD CONSTRAINT client_internal_notes_note_type_check
  CHECK (note_type = ANY (ARRAY[
    'admin'::text,
    'employee'::text,
    'system'::text,
    'Général'::text,
    'Facturation'::text,
    'Technique'::text,
    'Plainte'::text,
    'Suivi'::text,
    'Important'::text
  ]));

CREATE INDEX IF NOT EXISTS idx_client_internal_notes_account_id
  ON public.client_internal_notes(account_id);

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS route_to text;

CREATE INDEX IF NOT EXISTS idx_support_tickets_route_to
  ON public.support_tickets(route_to);