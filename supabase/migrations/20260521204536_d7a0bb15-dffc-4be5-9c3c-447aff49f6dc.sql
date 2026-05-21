
-- ============================================================================
-- PART 1 — Technician portal infrastructure
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.technician_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time_start TIME NOT NULL,
  scheduled_time_end TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled','en_route','arrived','in_progress','completed','missed','rescheduled','cancelled')
  ),
  client_notified_en_route BOOLEAN DEFAULT false,
  client_notified_next BOOLEAN DEFAULT false,
  client_notified_missed BOOLEAN DEFAULT false,
  technician_notes TEXT,
  installation_steps JSONB DEFAULT '[]'::jsonb,
  equipment_scanned JSONB DEFAULT '[]'::jsonb,
  network_test_results JSONB DEFAULT '{}'::jsonb,
  coaxial_status TEXT CHECK (
    coaxial_status IS NULL OR coaxial_status IN ('good','degraded','damaged','absent','not_checked')
  ),
  coaxial_notes TEXT,
  signal_strength INTEGER,
  download_speed NUMERIC(10,2),
  upload_speed NUMERIC(10,2),
  ping_ms INTEGER,
  installation_photos JSONB DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ,
  missed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tech_assign_tech_date ON public.technician_assignments(technician_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tech_assign_order ON public.technician_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_tech_assign_status ON public.technician_assignments(status);

CREATE TABLE IF NOT EXISTS public.installation_steps_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL CHECK (service_type IN ('internet','tv','bundle','mobile','equipment_only')),
  step_order INTEGER NOT NULL,
  title_fr TEXT NOT NULL,
  title_en TEXT,
  description_fr TEXT NOT NULL,
  description_en TEXT,
  requires_photo BOOLEAN DEFAULT false,
  requires_scan BOOLEAN DEFAULT false,
  requires_test BOOLEAN DEFAULT false,
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_type, step_order)
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.fn_tech_assignments_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_tech_assignments_touch ON public.technician_assignments;
CREATE TRIGGER trg_tech_assignments_touch BEFORE UPDATE ON public.technician_assignments
FOR EACH ROW EXECUTE FUNCTION public.fn_tech_assignments_touch();

-- ============================================================================
-- Seed installation steps (idempotent via UNIQUE constraint)
-- ============================================================================
INSERT INTO public.installation_steps_template
  (service_type, step_order, title_fr, description_fr, requires_photo, requires_scan, requires_test, is_mandatory)
VALUES
  ('internet',1,'Vérification de l''adresse','Confirmer que vous êtes à la bonne adresse. Vérifier le nom du client et l''adresse dans l''application.',false,false,false,true),
  ('internet',2,'Inspection du câble coaxial','Localiser la prise coaxiale murale. Vérifier l''état: fissures, connecteurs endommagés, signal faible. Prendre une photo.',true,false,false,true),
  ('internet',3,'Installation de la borne WiFi Nivra','Brancher la borne WiFi Nivra à la prise coaxiale. Scanner le code QR de la borne pour l''associer au compte client.',true,true,false,true),
  ('internet',4,'Test de connexion Internet','Attendre 2-3 minutes que la borne initialise. Vérifier voyant bleu/vert. Faire un test de vitesse.',false,false,true,true),
  ('internet',5,'Test WiFi sur appareil client','Aider le client à connecter son téléphone/ordinateur au WiFi Nivra. Vérifier que la connexion fonctionne.',false,false,false,true),
  ('internet',6,'Explication au client','Expliquer au client: nom du réseau WiFi, mot de passe, comment redémarrer la borne, contact support.',false,false,false,true),
  ('internet',7,'Signature de complétion','Faire signer le client pour confirmer que l''installation est complète et satisfaisante.',false,false,false,true),
  ('tv',1,'Installation du terminal TV 4K','Brancher le terminal Nivra 4K Smart sur le téléviseur via HDMI. Scanner le code QR du terminal.',true,true,false,true),
  ('tv',2,'Configuration du terminal','Allumer le terminal. Attendre l''initialisation (3-5 minutes). Vérifier l''affichage des chaînes.',false,false,false,true),
  ('tv',3,'Test des chaînes','Vérifier minimum 5 chaînes: zapping, qualité image, son. Tester une chaîne HD.',false,false,true,true),
  ('bundle',1,'Vérification adresse et commande','Confirmer adresse, nom client, forfait commandé (Internet + TV).',false,false,false,true),
  ('bundle',2,'Inspection câble coaxial','Vérifier état câble coaxial pour Internet ET pour TV.',true,false,false,true),
  ('bundle',3,'Installation borne WiFi','Brancher et scanner la borne WiFi Nivra.',true,true,false,true),
  ('bundle',4,'Installation terminal TV 4K','Brancher et scanner le terminal TV 4K.',true,true,false,true),
  ('bundle',5,'Tests Internet et TV','Test vitesse Internet + test chaînes TV.',false,false,true,true),
  ('bundle',6,'Explication complète au client','WiFi, TV, télécommande, support.',false,false,false,true),
  ('bundle',7,'Signature de complétion','Signature client pour confirmer satisfaction.',false,false,false,true)
ON CONFLICT (service_type, step_order) DO NOTHING;

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.technician_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_steps_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tech_assign_self_select" ON public.technician_assignments;
CREATE POLICY "tech_assign_self_select" ON public.technician_assignments FOR SELECT TO authenticated
USING (
  technician_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'techops')
);

DROP POLICY IF EXISTS "tech_assign_self_update" ON public.technician_assignments;
CREATE POLICY "tech_assign_self_update" ON public.technician_assignments FOR UPDATE TO authenticated
USING (
  technician_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'techops')
)
WITH CHECK (
  technician_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'techops')
);

DROP POLICY IF EXISTS "tech_assign_admin_insert" ON public.technician_assignments;
CREATE POLICY "tech_assign_admin_insert" ON public.technician_assignments FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'employee')
  OR public.has_role(auth.uid(),'supervisor')
  OR public.has_role(auth.uid(),'techops')
);

DROP POLICY IF EXISTS "tech_assign_admin_delete" ON public.technician_assignments;
CREATE POLICY "tech_assign_admin_delete" ON public.technician_assignments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "install_steps_read_all" ON public.installation_steps_template;
CREATE POLICY "install_steps_read_all" ON public.installation_steps_template FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "install_steps_admin_write" ON public.installation_steps_template;
CREATE POLICY "install_steps_admin_write" ON public.installation_steps_template FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================================
-- PART 3 — Trigger fn_installation_completed (ADAPTED to real schema)
--   orders has: user_id, status, service_activated_at, service_type, category, total_amount, order_number
--   accounts uses client_id (= profiles.user_id)
--   billing_subscriptions uses customer_id (= billing_customers.id, lookup by email)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_installation_completed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_client_email TEXT;
  v_client_first TEXT;
  v_customer_id UUID;
  v_tech_name TEXT;
  v_plan_label TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN

    -- Load order + client info
    SELECT o.*, p.email AS p_email, COALESCE(p.first_name, p.full_name, 'Client') AS p_first
    INTO v_order
    FROM public.orders o
    LEFT JOIN public.profiles p ON p.user_id = o.user_id
    WHERE o.id = NEW.order_id;

    IF v_order IS NULL THEN
      RETURN NEW;
    END IF;

    v_client_email := COALESCE(v_order.client_email, v_order.p_email);
    v_client_first := v_order.p_first;
    v_plan_label := COALESCE(v_order.service_type, 'Service') ||
      CASE WHEN v_order.category IS NOT NULL THEN ' — ' || v_order.category ELSE '' END;

    -- 1. Mark order as completed + activated
    UPDATE public.orders
    SET status = 'completed',
        service_activated_at = COALESCE(service_activated_at, now()),
        service_activation_source = COALESCE(service_activation_source, 'technician_portal'),
        updated_at = now()
    WHERE id = NEW.order_id;

    -- 2. Activate the account (via client_id = orders.user_id)
    UPDATE public.accounts
    SET status = 'active', updated_at = now()
    WHERE client_id = v_order.user_id AND status <> 'active';

    -- 3. Resolve billing_customer for subscription (by email, lowercase)
    IF v_client_email IS NOT NULL THEN
      SELECT id INTO v_customer_id FROM public.billing_customers
      WHERE lower(email) = lower(v_client_email) LIMIT 1;

      -- Create subscription only if order has a price and no active sub already for this order
      IF v_customer_id IS NOT NULL AND COALESCE(v_order.total_amount, 0) > 0 THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.billing_subscriptions
          WHERE customer_id = v_customer_id AND order_id = NEW.order_id
        ) THEN
          INSERT INTO public.billing_subscriptions
            (customer_id, plan_code, plan_name, plan_price, status,
             cycle_start_date, next_renewal_at, service_category, order_id,
             environment, recurring_setup_status)
          VALUES
            (v_customer_id,
             COALESCE(v_order.category, v_order.service_type, 'service'),
             v_plan_label,
             v_order.total_amount,
             'active'::billing_subscription_status,
             CURRENT_DATE,
             now() + INTERVAL '30 days',
             v_order.service_type,
             NEW.order_id,
             COALESCE(v_order.environment, 'live'),
             'pending'::recurring_setup_status);
        END IF;
      END IF;
    END IF;

    -- 4. Tech name for support email
    SELECT COALESCE(full_name, email, 'Technicien') INTO v_tech_name
    FROM public.profiles WHERE user_id = NEW.technician_id;

    -- 5. Queue completion email to CLIENT
    IF v_client_email IS NOT NULL THEN
      INSERT INTO public.email_queue (to_email, template_key, template_vars, status)
      VALUES (
        v_client_email,
        'tech_completed',
        jsonb_build_object(
          'first_name', v_client_first,
          'plan_name', v_plan_label,
          'order_number', COALESCE(v_order.order_number, NEW.order_id::text),
          'renewal_date', to_char(now() + INTERVAL '30 days', 'DD/MM/YYYY'),
          'speed', COALESCE(NEW.download_speed::text || ' Mbps', 'N/A')
        ),
        'queued'
      );
    END IF;

    -- 6. BCC to support
    INSERT INTO public.email_queue (to_email, template_key, template_vars, status)
    VALUES (
      'support@nivra-telecom.ca',
      'tech_completed',
      jsonb_build_object(
        'first_name', v_client_first,
        'plan_name', v_plan_label,
        'order_number', COALESCE(v_order.order_number, NEW.order_id::text),
        'tech_name', COALESCE(v_tech_name, 'Technicien'),
        'client_email', COALESCE(v_client_email, 'inconnu')
      ),
      'queued'
    );

    -- Stamp completed_at
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_installation_completed ON public.technician_assignments;
CREATE TRIGGER trg_installation_completed
BEFORE UPDATE OF status ON public.technician_assignments
FOR EACH ROW EXECUTE FUNCTION public.fn_installation_completed();

-- ============================================================================
-- PART 6 — Nivra Telecom Tech profile + technician role
--   Existing profile user_id: cc9e952a-62d6-4b0c-bded-91f4b2d9ea8f
-- ============================================================================
UPDATE public.profiles
SET full_name = 'Nivra Telecom Tech',
    first_name = COALESCE(first_name, 'Nivra'),
    updated_at = now()
WHERE user_id = 'cc9e952a-62d6-4b0c-bded-91f4b2d9ea8f';

INSERT INTO public.user_roles (user_id, role, is_active, status)
VALUES ('cc9e952a-62d6-4b0c-bded-91f4b2d9ea8f', 'technician', true, 'active')
ON CONFLICT DO NOTHING;
