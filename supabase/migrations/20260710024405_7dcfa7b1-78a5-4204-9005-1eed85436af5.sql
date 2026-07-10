-- Module 29 (Service TV) F29-4 & F29-10 — scope multi-account
-- 1) channel_selections: add account_id (nullable) + index
ALTER TABLE public.channel_selections
  ADD COLUMN IF NOT EXISTS account_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_channel_selections_user_account
  ON public.channel_selections(user_id, account_id);

-- 2) tv_parental_controls: allow one row per (user_id, account_id)
--    Drop legacy unique(user_id) and replace with (user_id, account_id) NULLS NOT DISTINCT.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.tv_parental_controls'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(user_id)%'
    AND pg_get_constraintdef(oid) NOT ILIKE '%account_id%'
  LIMIT 1;
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.tv_parental_controls DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

-- Drop any duplicate legacy unique index on user_id alone
DO $$
DECLARE
  idx_name text;
BEGIN
  FOR idx_name IN
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename='tv_parental_controls'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(user_id)%'
      AND indexdef NOT ILIKE '%account_id%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tv_parental_controls_user_account
  ON public.tv_parental_controls(user_id, account_id) NULLS NOT DISTINCT;