-- ═══════════════════════════════════════════════════════
-- FIX 5 — Nivra Source Hub tables
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.hub_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('general','pricing','system','contest','urgent','formation','policy')),
  visible_to TEXT[] DEFAULT ARRAY['field_sales','employee','rh','technician','admin'],
  is_pinned BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hub_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('contract','policy','guide','form','fiscal','branding','faq','other')),
  file_url TEXT,
  file_type TEXT,
  visible_to TEXT[] DEFAULT ARRAY['field_sales','employee','rh','technician','admin'],
  is_published BOOLEAN DEFAULT false,
  version TEXT DEFAULT '1.0',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hub_store_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'uniform' CHECK (category IN ('uniform','badge','accessory','card','promotional','other')),
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT true,
  sizes TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hub_store_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_id UUID REFERENCES public.hub_store_items(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  size TEXT,
  custom_info JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','processing','shipped','delivered','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hub_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'general' CHECK (event_type IN ('formation','contest','meeting','deadline','maintenance','general','other')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  visible_to TEXT[] DEFAULT ARRAY['field_sales','employee','rh','technician','admin'],
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hub_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_calendar_events ENABLE ROW LEVEL SECURITY;

-- Helper: any internal staff
CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND is_active = true
      AND role::text IN ('admin','employee','technician','supervisor','sales','kyc_agent','billing_admin','techops','support','field_sales','rh')
  );
$$;

-- Announcements
CREATE POLICY "staff view published announcements" ON public.hub_announcements
  FOR SELECT TO authenticated
  USING (is_published = true AND public.is_internal_staff(auth.uid()));
CREATE POLICY "admin manage announcements" ON public.hub_announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Documents
CREATE POLICY "staff view published docs" ON public.hub_documents
  FOR SELECT TO authenticated
  USING (is_published = true AND public.is_internal_staff(auth.uid()));
CREATE POLICY "admin manage docs" ON public.hub_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Store items
CREATE POLICY "staff view available items" ON public.hub_store_items
  FOR SELECT TO authenticated
  USING (is_available = true AND public.is_internal_staff(auth.uid()));
CREATE POLICY "admin manage items" ON public.hub_store_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Store orders
CREATE POLICY "staff view own orders" ON public.hub_store_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "staff create own orders" ON public.hub_store_orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_internal_staff(auth.uid()));
CREATE POLICY "admin manage orders" ON public.hub_store_orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Calendar
CREATE POLICY "staff view calendar" ON public.hub_calendar_events
  FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "admin manage calendar" ON public.hub_calendar_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ═══════════════════════════════════════════════════════
-- FIX 1 — Commission approval notification trigger
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.notify_commission_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  agent_email TEXT;
  agent_name TEXT;
  order_no TEXT;
BEGIN
  IF (TG_OP = 'UPDATE'
      AND NEW.status = 'approved'
      AND COALESCE(OLD.status, '') <> 'approved') THEN

    SELECT email, COALESCE(full_name, email)
      INTO agent_email, agent_name
      FROM public.profiles
      WHERE user_id = NEW.agent_id
      LIMIT 1;

    SELECT COALESCE(o.order_number, '#' || substring(NEW.sale_id::text, 1, 8))
      INTO order_no
      FROM public.orders o
      WHERE o.id = NEW.sale_id
      LIMIT 1;
    IF order_no IS NULL THEN
      order_no := COALESCE('#' || substring(NEW.sale_id::text, 1, 8), 'N/A');
    END IF;

    -- In-app notification
    INSERT INTO public.employee_notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.agent_id,
      'system',
      'Commission approuvée',
      'Votre commission de ' || to_char(NEW.amount, 'FM999G990D00') || ' $ pour la commande ' || order_no || ' a été approuvée.',
      jsonb_build_object('commission_id', NEW.id, 'order_id', NEW.sale_id, 'amount', NEW.amount)
    );

    -- Email queue
    IF agent_email IS NOT NULL THEN
      INSERT INTO public.email_queue (template_key, to_email, variables, status)
      VALUES (
        'commission_approved',
        agent_email,
        jsonb_build_object(
          'agent_name', agent_name,
          'order_number', order_no,
          'amount', NEW.amount,
          'status_label', 'Approuvée'
        ),
        'queued'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_field_commission_approved ON public.field_commissions;
CREATE TRIGGER trg_field_commission_approved
  AFTER UPDATE ON public.field_commissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_commission_approved();