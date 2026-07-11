ALTER TABLE public.internal_tickets DROP CONSTRAINT internal_tickets_status_check;
ALTER TABLE public.internal_tickets ADD CONSTRAINT internal_tickets_status_check
  CHECK (status = ANY (ARRAY['open','assigned','investigating','waiting_information','in_progress','pending','resolved','closed']));