CREATE OR REPLACE FUNCTION public.normalize_activity_logs_system_auto_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.actor_role = 'system_auto' THEN
    NEW.actor_name := 'Système Nivra';
    NEW.actor_email := NULL;

    IF NEW.details IS NOT NULL AND NEW.details ? 'note' THEN
      NEW.details := jsonb_set(
        NEW.details,
        '{note}',
        to_jsonb(regexp_replace(NEW.details->>'note', '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', 'un agent autorisé', 'g')),
        true
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_client_internal_notes_system_auto_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by_role = 'system_auto' THEN
    NEW.created_by_user_id := '00000000-0000-0000-0000-000000000000';
    NEW.created_by_name := 'Système Nivra';

    IF NEW.body IS NOT NULL THEN
      NEW.body := regexp_replace(NEW.body, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', 'un agent autorisé', 'g');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_system_auto_activity_logs ON public.activity_logs;
CREATE TRIGGER trg_normalize_system_auto_activity_logs
BEFORE INSERT OR UPDATE ON public.activity_logs
FOR EACH ROW
WHEN (NEW.actor_role = 'system_auto')
EXECUTE FUNCTION public.normalize_activity_logs_system_auto_actor();

DROP TRIGGER IF EXISTS trg_normalize_system_auto_client_internal_notes ON public.client_internal_notes;
CREATE TRIGGER trg_normalize_system_auto_client_internal_notes
BEFORE INSERT OR UPDATE ON public.client_internal_notes
FOR EACH ROW
WHEN (NEW.created_by_role = 'system_auto')
EXECUTE FUNCTION public.normalize_client_internal_notes_system_auto_actor();

UPDATE public.activity_logs
SET
  actor_name = 'Système Nivra',
  actor_email = NULL,
  details = CASE
    WHEN details IS NOT NULL AND details ? 'note' THEN jsonb_set(
      details,
      '{note}',
      to_jsonb(regexp_replace(details->>'note', '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', 'un agent autorisé', 'g')),
      true
    )
    ELSE details
  END
WHERE actor_role = 'system_auto'
  AND (
    actor_name IS DISTINCT FROM 'Système Nivra'
    OR actor_email IS NOT NULL
    OR (details IS NOT NULL AND details ? 'note' AND details->>'note' ~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
  );

UPDATE public.client_internal_notes
SET
  created_by_user_id = '00000000-0000-0000-0000-000000000000',
  created_by_name = 'Système Nivra',
  body = regexp_replace(body, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', 'un agent autorisé', 'g')
WHERE created_by_role = 'system_auto'
  AND (
    created_by_user_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000000'
    OR created_by_name IS DISTINCT FROM 'Système Nivra'
    OR body ~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
  );