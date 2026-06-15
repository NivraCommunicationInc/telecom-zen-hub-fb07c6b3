-- ============================================================
-- Migration: Champs identité manquants pour testlive@nivra-telecom.ca
-- Date: 2026-06-15 (v1)
-- Idempotent: oui
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'testlive@nivra-telecom.ca'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'SKIP: testlive@nivra-telecom.ca introuvable';
    RETURN;
  END IF;

  UPDATE public.profiles SET
    date_of_birth       = COALESCE(date_of_birth, '1990-01-01'),
    id_type             = COALESCE(id_type, 'drivers_license'),
    id_number           = COALESCE(id_number, 'T0123456789'),
    id_expiration       = COALESCE(id_expiration, '2030-01-01'),
    id_province         = COALESCE(id_province, 'QC'),
    updated_at          = NOW()
  WHERE user_id = v_user_id;

  RAISE NOTICE 'Champs identité OK pour user_id=%', v_user_id;

END $$;
