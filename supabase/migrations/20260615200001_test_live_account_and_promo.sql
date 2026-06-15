-- ============================================================
-- Migration: Code promo TESTLIVE99 + complétion profil
-- Projet cible: xtgngmtxggascbxnswvb (ancien projet Lovable)
-- Date: 2026-06-15 (v2 — user créé via signUp, pas via SQL)
-- Idempotent: oui
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN

  -- Trouver l'utilisateur existant
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'testlive@nivra-telecom.ca'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'SKIP: testlive@nivra-telecom.ca introuvable dans auth.users — créer le compte manuellement d''abord';
    RETURN;
  END IF;

  RAISE NOTICE 'User trouvé: %', v_user_id;

  -- ── 1. Rôle client si absent ──
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- ── 2. Compléter le profil (champs adresse manquants) ──
  UPDATE public.profiles SET
    first_name          = COALESCE(first_name, 'Test'),
    last_name           = COALESCE(last_name, 'Live'),
    phone               = COALESCE(phone, '450-235-5110'),
    service_address     = COALESCE(service_address, '1234 Rue Sainte-Catherine Ouest'),
    service_city        = COALESCE(service_city, 'Montréal'),
    service_province    = 'QC',
    service_postal_code = COALESCE(service_postal_code, 'H3G 1P1'),
    updated_at          = NOW()
  WHERE user_id = v_user_id;

  -- ── 3. Créer ou mettre à jour la promotion TESTLIVE99 ──
  IF EXISTS (SELECT 1 FROM public.promotions WHERE UPPER(TRIM(code)) = 'TESTLIVE99') THEN
    UPDATE public.promotions SET
      status                = 'active',
      discount_value        = 99,
      restricted_client_ids = ARRAY[v_user_id],
      scope                 = 'restricted',
      updated_at            = NOW()
    WHERE UPPER(TRIM(code)) = 'TESTLIVE99';
    RAISE NOTICE 'TESTLIVE99 promo mise à jour (user_id=%)', v_user_id;
  ELSE
    INSERT INTO public.promotions (
      code, name, description, status, discount_type, discount_value,
      applies_to, scope, restricted_client_ids,
      usage_limit_total, usage_limit_per_client, start_at, end_at, stackable
    ) VALUES (
      'TESTLIVE99',
      'Compte Test Live — 99% Rabais',
      'Code promo dédié testlive@nivra-telecom.ca — 99% sur tout (tests internes, no expiry)',
      'active', 'percent', 99,
      '{"services": true, "one_time_fees": true, "equipment": true, "delivery": true, "installation": true}'::jsonb,
      'restricted', ARRAY[v_user_id],
      NULL, NULL, NULL, NULL, FALSE
    );
    RAISE NOTICE 'TESTLIVE99 promo créée (user_id=%)', v_user_id;
  END IF;

  RAISE NOTICE 'TESTLIVE99 promo OK pour user_id=%', v_user_id;

END $$;
