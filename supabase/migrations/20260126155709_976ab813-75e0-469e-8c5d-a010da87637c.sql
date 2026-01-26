-- ============================================
-- CORRECTION GLOBALE: Synchronisation Billing V2
-- Version finale - Types corrigés
-- ============================================

-- 0. Ajouter 'system' comme type de note valide pour les corrections automatiques futures
ALTER TABLE client_internal_notes DROP CONSTRAINT IF EXISTS client_internal_notes_note_type_check;
ALTER TABLE client_internal_notes ADD CONSTRAINT client_internal_notes_note_type_check 
  CHECK (note_type = ANY (ARRAY['admin'::text, 'employee'::text, 'system'::text]));

-- 1. Synchroniser billing_customers.user_id avec profiles VALIDES (qui ont un auth.users)
UPDATE billing_customers bc
SET user_id = p.id
FROM profiles p
INNER JOIN auth.users u ON u.id = p.id
WHERE bc.email = p.email
  AND (bc.user_id IS NULL OR bc.user_id != p.id);

-- 2. Créer les billing_customers manquants pour les utilisateurs VALIDES avec factures legacy
INSERT INTO billing_customers (user_id, email, first_name, last_name, phone, status)
SELECT DISTINCT
  p.id as user_id,
  p.email,
  COALESCE(p.first_name, 'Client') as first_name,
  COALESCE(p.last_name, '') as last_name,
  COALESCE(p.phone, '') as phone,
  'active'::billing_customer_status as status
FROM profiles p
INNER JOIN auth.users u ON u.id = p.id
INNER JOIN billing b ON b.user_id = p.id
WHERE p.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM billing_customers bc WHERE bc.user_id = p.id
  )
ON CONFLICT (email) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  updated_at = now();

-- 3. Corriger les billing.user_id orphelins (lier via email si profile+auth valide)
UPDATE billing b
SET user_id = p.id
FROM profiles p
INNER JOIN auth.users u ON u.id = p.id
WHERE b.client_email = p.email
  AND b.user_id != p.id;

-- 4. Logger les corrections automatiques (note système)
INSERT INTO client_internal_notes (client_id, body, note_type, created_by_user_id, created_by_role, created_by_name)
SELECT DISTINCT
  bc.user_id as client_id,
  '[CORRECTION_FACTURATION] Synchronisation automatique du compte billing V2. user_id et billing_customers alignés.' as body,
  'system' as note_type,
  bc.user_id as created_by_user_id,
  'system' as created_by_role,
  'Système Nivra' as created_by_name
FROM billing_customers bc
INNER JOIN auth.users u ON u.id = bc.user_id
WHERE bc.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM client_internal_notes cin 
    WHERE cin.client_id = bc.user_id 
    AND cin.body LIKE '%CORRECTION_FACTURATION%Synchronisation automatique%'
  );

-- 5. Créer un trigger pour auto-lier les futurs billing_customers
CREATE OR REPLACE FUNCTION public.auto_link_billing_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT p.id INTO v_user_id
    FROM profiles p
    INNER JOIN auth.users u ON u.id = p.id
    WHERE p.email = NEW.email
    LIMIT 1;
    
    NEW.user_id := v_user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_billing_customer ON billing_customers;

CREATE TRIGGER trg_auto_link_billing_customer
BEFORE INSERT OR UPDATE ON billing_customers
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_billing_customer();

-- 6. Créer un trigger pour auto-créer billing_customer lors d'une nouvelle facture legacy
CREATE OR REPLACE FUNCTION public.ensure_billing_customer_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_auth_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = NEW.user_id) INTO v_auth_exists;
  
  IF NOT v_auth_exists THEN
    RETURN NEW;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM billing_customers WHERE user_id = NEW.user_id) THEN
    SELECT * INTO v_profile FROM profiles WHERE id = NEW.user_id;
    
    IF v_profile.id IS NOT NULL AND v_profile.email IS NOT NULL THEN
      INSERT INTO billing_customers (user_id, email, first_name, last_name, phone, status)
      VALUES (
        NEW.user_id,
        v_profile.email,
        COALESCE(v_profile.first_name, 'Client'),
        COALESCE(v_profile.last_name, ''),
        COALESCE(v_profile.phone, ''),
        'active'::billing_customer_status
      )
      ON CONFLICT (email) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        updated_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_billing_customer ON billing;

CREATE TRIGGER trg_ensure_billing_customer
AFTER INSERT ON billing
FOR EACH ROW
EXECUTE FUNCTION public.ensure_billing_customer_exists();