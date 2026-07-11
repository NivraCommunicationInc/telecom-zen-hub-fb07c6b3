ALTER TABLE public.client_internal_notes DROP CONSTRAINT IF EXISTS client_internal_notes_note_type_check;
ALTER TABLE public.client_internal_notes ADD CONSTRAINT client_internal_notes_note_type_check
  CHECK (note_type = ANY (ARRAY[
    'admin'::text, 'employee'::text, 'system'::text,
    'Général'::text, 'Facturation'::text, 'Technique'::text, 'Plainte'::text, 'Suivi'::text, 'Important'::text,
    'security'::text
  ]));