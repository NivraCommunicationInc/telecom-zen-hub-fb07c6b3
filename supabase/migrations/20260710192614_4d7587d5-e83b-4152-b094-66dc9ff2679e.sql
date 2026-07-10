
-- ============================================================
-- Module 37 — Phase A : Consent Journal (Loi 25) DB Foundations
-- ============================================================

-- 1) Enums stricts
DO $$ BEGIN
  CREATE TYPE public.consent_type_enum AS ENUM (
    'marketing_email','marketing_sms','autopay','service_changes','privacy_request','terms_of_use','loi25_general'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.consent_status_enum AS ENUM ('granted','revoked','verified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.consent_channel_enum AS ENUM ('phone','email','portal','in_person','api','sms');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Table append-only (registre légal Loi 25)
CREATE TABLE IF NOT EXISTS public.consent_records (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id             uuid NULL,
  subject_user_id        uuid NOT NULL,
  consent_type           public.consent_type_enum NOT NULL,
  status                 public.consent_status_enum NOT NULL,
  channel                public.consent_channel_enum NOT NULL,
  proof_ref              text NULL,
  proof_hash             text NULL,
  consent_text_version   text NULL,
  consent_text_hash      text NULL,
  ip_address             inet NULL,
  user_agent             text NULL,
  notes                  text NULL,
  idempotency_key        text NOT NULL,
  recorded_by_user_id    uuid NULL,
  recorded_by_role       text NOT NULL CHECK (recorded_by_role IN ('subject','core_admin','core_staff','supervisor','support','admin','employee','system')),
  recorded_by_email      text NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_records_notes_len   CHECK (notes IS NULL OR length(notes) <= 2000),
  CONSTRAINT consent_records_proof_len   CHECK (proof_ref IS NULL OR length(proof_ref) <= 500),
  CONSTRAINT consent_records_version_len CHECK (consent_text_version IS NULL OR length(consent_text_version) <= 64)
);

-- 3) GRANTs (registre lecture par titulaire + staff; écritures via service_role uniquement)
GRANT SELECT ON public.consent_records TO authenticated;
GRANT ALL    ON public.consent_records TO service_role;

-- 4) Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_records_idempotency_key
  ON public.consent_records(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_consent_records_subject_type_created
  ON public.consent_records(subject_user_id, consent_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_records_account
  ON public.consent_records(account_id) WHERE account_id IS NOT NULL;

-- 5) RLS
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny anon consent_records"                 ON public.consent_records;
DROP POLICY IF EXISTS "Subject can view own consent_records"      ON public.consent_records;
DROP POLICY IF EXISTS "Staff can view consent_records"            ON public.consent_records;
DROP POLICY IF EXISTS "No direct insert consent_records"          ON public.consent_records;
DROP POLICY IF EXISTS "No update consent_records"                 ON public.consent_records;
DROP POLICY IF EXISTS "No delete consent_records"                 ON public.consent_records;

CREATE POLICY "Deny anon consent_records"
  ON public.consent_records AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Subject can view own consent_records"
  ON public.consent_records FOR SELECT TO authenticated
  USING (subject_user_id = auth.uid());

CREATE POLICY "Staff can view consent_records"
  ON public.consent_records FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'employee'::public.app_role)
    OR public.has_role(auth.uid(), 'support'::public.app_role)
    OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
  );

-- Aucune policy INSERT/UPDATE/DELETE pour authenticated → écriture serveur uniquement (service_role).
-- Immuabilité juridique : même le service_role est bloqué en UPDATE/DELETE par le trigger ci-dessous.

-- 6) Trigger d'immuabilité + SINGLE-DOOR
CREATE OR REPLACE FUNCTION public.consent_records_guard_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bypass_flag text;
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'INVARIANT-CONSENT-IMMUTABLE: consent_records is append-only (Loi 25). % refused.', TG_OP
      USING ERRCODE = '42501';
  END IF;

  -- INSERT : exiger la porte canonique (flag posé par la RPC consent-journal-action)
  BEGIN
    bypass_flag := current_setting('app.consent_write_ok', true);
  EXCEPTION WHEN OTHERS THEN
    bypass_flag := NULL;
  END;

  IF bypass_flag IS NULL OR lower(bypass_flag) NOT IN ('1','on','true','yes') THEN
    RAISE EXCEPTION 'INVARIANT-CONSENT-SINGLE-DOOR: direct writes to consent_records are forbidden. Use consent-journal-action.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consent_records_guard_iud ON public.consent_records;
CREATE TRIGGER trg_consent_records_guard_iud
  BEFORE INSERT OR UPDATE OR DELETE ON public.consent_records
  FOR EACH ROW EXECUTE FUNCTION public.consent_records_guard_write();

-- 7) RPC canonique (service-role bypass via session flag)
CREATE OR REPLACE FUNCTION public.rpc_create_consent_record(
  p_subject_user_id      uuid,
  p_consent_type         public.consent_type_enum,
  p_status               public.consent_status_enum,
  p_channel              public.consent_channel_enum,
  p_idempotency_key      text,
  p_account_id           uuid   DEFAULT NULL,
  p_proof_ref            text   DEFAULT NULL,
  p_proof_hash           text   DEFAULT NULL,
  p_consent_text_version text   DEFAULT NULL,
  p_consent_text_hash    text   DEFAULT NULL,
  p_ip_address           inet   DEFAULT NULL,
  p_user_agent           text   DEFAULT NULL,
  p_notes                text   DEFAULT NULL,
  p_recorded_by_user_id  uuid   DEFAULT NULL,
  p_recorded_by_role     text   DEFAULT 'subject',
  p_recorded_by_email    text   DEFAULT NULL
)
RETURNS public.consent_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.consent_records;
BEGIN
  IF p_subject_user_id IS NULL THEN
    RAISE EXCEPTION 'subject_user_id required' USING ERRCODE = '22004';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'idempotency_key required (min 8 chars)' USING ERRCODE = '22004';
  END IF;

  -- Idempotence : retourne la ligne existante si même clé
  SELECT * INTO v_row FROM public.consent_records WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  PERFORM set_config('app.consent_write_ok','1', true);

  INSERT INTO public.consent_records (
    account_id, subject_user_id, consent_type, status, channel,
    proof_ref, proof_hash, consent_text_version, consent_text_hash,
    ip_address, user_agent, notes, idempotency_key,
    recorded_by_user_id, recorded_by_role, recorded_by_email
  ) VALUES (
    p_account_id, p_subject_user_id, p_consent_type, p_status, p_channel,
    p_proof_ref, p_proof_hash, p_consent_text_version, p_consent_text_hash,
    p_ip_address, p_user_agent, p_notes, p_idempotency_key,
    p_recorded_by_user_id, p_recorded_by_role, p_recorded_by_email
  )
  RETURNING * INTO v_row;

  PERFORM set_config('app.consent_write_ok','', true);
  RETURN v_row;
EXCEPTION WHEN unique_violation THEN
  PERFORM set_config('app.consent_write_ok','', true);
  SELECT * INTO v_row FROM public.consent_records WHERE idempotency_key = p_idempotency_key;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_consent_record(
  uuid, public.consent_type_enum, public.consent_status_enum, public.consent_channel_enum,
  text, uuid, text, text, text, text, inet, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_create_consent_record(
  uuid, public.consent_type_enum, public.consent_status_enum, public.consent_channel_enum,
  text, uuid, text, text, text, text, inet, text, text, uuid, text, text
) TO service_role;
