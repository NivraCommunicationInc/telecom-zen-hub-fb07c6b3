-- ============================================================
-- Migration: Compte client de test + code promo TESTLIVE99
-- Projet: xtgngmtxggascbxnswvb (ancien projet Lovable)
-- Date: 2026-06-15
-- Idempotent: oui (safe to run multiple times)
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
  v_profile_exists BOOLEAN;
  v_promo_exists   BOOLEAN;
BEGIN

  -- ── 1. Vérifier si l'utilisateur existe déjà ──
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'testlive@nivra-telecom.ca'
  LIMIT 1;

  -- ── 2. Créer l'utilisateur auth si absent ──
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      raw_app_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'testlive@nivra-telecom.ca',
      crypt('NivraTest2026!', gen_salt('bf')),
      NOW(),
      '{"full_name": "Test Live", "first_name": "Test", "last_name": "Live", "phone": "4502355110"}'::jsonb,
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      FALSE,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    -- Identité email requise par Supabase Auth
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object(
        'sub',   v_user_id::text,
        'email', 'testlive@nivra-telecom.ca'
      ),
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Utilisateur auth créé: %', v_user_id;
  ELSE
    RAISE NOTICE 'Utilisateur auth déjà existant: %', v_user_id;
  END IF;

  -- ── 3. Attendre que le trigger on_auth_user_created ait créé le profil ──
  -- (le trigger INSERT INTO profiles est synchrone, donc on peut l'UPDATE immédiatement)

  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE user_id = v_user_id
  ) INTO v_profile_exists;

  IF NOT v_profile_exists THEN
    -- Créer le profil manuellement si le trigger n'a pas tourné
    INSERT INTO public.profiles (user_id, email, full_name, first_name, last_name, phone)
    VALUES (v_user_id, 'testlive@nivra-telecom.ca', 'Test Live', 'Test', 'Live', '450-235-5110')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Mettre à jour les champs manquants (idempotent)
  UPDATE public.profiles SET
    first_name          = 'Test',
    last_name           = 'Live',
    phone               = '450-235-5110',
    service_address     = '1234 Rue Sainte-Catherine Ouest',
    service_city        = 'Montréal',
    service_province    = 'QC',
    service_postal_code = 'H3G 1P1',
    updated_at          = NOW()
  WHERE user_id = v_user_id;

  -- ── 4. Rôle client si absent ──
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- ── 5. Créer la promotion TESTLIVE99 si absente ──
  SELECT EXISTS(
    SELECT 1 FROM public.promotions WHERE UPPER(TRIM(code)) = 'TESTLIVE99'
  ) INTO v_promo_exists;

  IF NOT v_promo_exists THEN
    INSERT INTO public.promotions (
      code,
      name,
      description,
      status,
      discount_type,
      discount_value,
      applies_to,
      scope,
      restricted_client_ids,
      usage_limit_total,
      usage_limit_per_client,
      start_at,
      end_at,
      stackable
    ) VALUES (
      'TESTLIVE99',
      'Compte Test Live — 99% Rabais',
      'Code promo dédié au compte testlive@nivra-telecom.ca — 99% de rabais sur tous les services (tests internes uniquement, no expiry)',
      'active',
      'percent',
      99,
      '{"services": true, "one_time_fees": true, "equipment": true, "delivery": true, "installation": true}'::jsonb,
      'restricted',
      ARRAY[v_user_id],
      NULL,
      NULL,
      NULL,
      NULL,
      FALSE
    );
    RAISE NOTICE 'Promo TESTLIVE99 créée (user_id=%)', v_user_id;
  ELSE
    -- S'assurer que restricted_client_ids contient bien le bon user_id
    UPDATE public.promotions
    SET restricted_client_ids = ARRAY[v_user_id],
        scope                 = 'restricted',
        status                = 'active',
        updated_at            = NOW()
    WHERE UPPER(TRIM(code)) = 'TESTLIVE99';
    RAISE NOTICE 'Promo TESTLIVE99 déjà existante — mise à jour restricted_client_ids';
  END IF;

END $$;
