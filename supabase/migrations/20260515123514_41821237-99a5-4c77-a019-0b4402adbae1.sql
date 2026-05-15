-- Nivra Source Hub — full content schema
-- Adds: hub_posts, hub_tickets, hub_ticket_messages, hub_reactions,
--       hub_notifications, hub_orders, hub_contests, hub_faq, hub_directory.
-- All other existing hub_* tables (announcements, documents, store_items,
-- store_orders, calendar_events, login_audit) are preserved unchanged.

-- ============================================================
-- 1) hub_posts — unified rich-content posts for many sections
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL CHECK (section IN (
    'announcements','documents','store','leaderboard',
    'calendar','forms','contests','tips','pricing',
    'tickets','feed','faq','directory','training'
  )),
  title TEXT NOT NULL,
  content TEXT,
  rich_content JSONB,
  media_urls TEXT[],
  document_urls TEXT[],
  video_urls TEXT[],
  external_links JSONB,
  category TEXT,
  tags TEXT[],
  visible_to TEXT[] DEFAULT ARRAY['field_sales','employee','technician','admin','hr'],
  is_pinned BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hub_posts_section_pub ON public.hub_posts(section, is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_posts_pinned ON public.hub_posts(is_pinned) WHERE is_pinned = true;

-- ============================================================
-- 2) hub_tickets — internal ticket system
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL DEFAULT 'TKT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),
  submitted_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  section TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  form_data JSONB,
  media_urls TEXT[],
  document_urls TEXT[],
  tags TEXT[],
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hub_tickets_submitted_by ON public.hub_tickets(submitted_by);
CREATE INDEX IF NOT EXISTS idx_hub_tickets_status ON public.hub_tickets(status);

-- ============================================================
-- 3) hub_ticket_messages — replies on tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.hub_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  media_urls TEXT[],
  document_urls TEXT[],
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hub_ticket_messages_ticket ON public.hub_ticket_messages(ticket_id, created_at);

-- ============================================================
-- 4) hub_reactions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.hub_posts(id) ON DELETE CASCADE,
  reaction TEXT DEFAULT 'thumbs_up' CHECK (reaction IN ('thumbs_up','check','fire','clap','heart')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id, reaction)
);
CREATE INDEX IF NOT EXISTS idx_hub_reactions_post ON public.hub_reactions(post_id);

-- ============================================================
-- 5) hub_notifications — push-style broadcast
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_roles TEXT[] DEFAULT ARRAY['field_sales','employee','technician','hr'],
  is_read_by UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hub_notifications_created ON public.hub_notifications(created_at DESC);

-- ============================================================
-- 6) hub_orders — store orders v2 (richer than hub_store_orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL DEFAULT 'ORD-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.hub_store_items(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  size TEXT,
  custom_info JSONB,
  delivery_address TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','processing','shipped','delivered','cancelled')),
  admin_notes TEXT,
  approved_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hub_orders_user ON public.hub_orders(user_id);

-- ============================================================
-- 7) hub_contests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  rules TEXT,
  prize TEXT,
  prize_value DECIMAL(10,2),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','ended')),
  visible_to TEXT[] DEFAULT ARRAY['field_sales'],
  winner_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  media_urls TEXT[],
  created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8) hub_faq
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  visible_to TEXT[] DEFAULT ARRAY['field_sales','employee','technician','hr','admin'],
  is_published BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9) hub_directory
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  email TEXT,
  phone TEXT,
  extension TEXT,
  avatar_url TEXT,
  is_visible BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- updated_at triggers (reuse existing helper)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='update_updated_at_column' AND pronamespace='public'::regnamespace) THEN
    DROP TRIGGER IF EXISTS trg_hub_posts_updated   ON public.hub_posts;
    CREATE TRIGGER trg_hub_posts_updated   BEFORE UPDATE ON public.hub_posts   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    DROP TRIGGER IF EXISTS trg_hub_tickets_updated ON public.hub_tickets;
    CREATE TRIGGER trg_hub_tickets_updated BEFORE UPDATE ON public.hub_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    DROP TRIGGER IF EXISTS trg_hub_orders_updated  ON public.hub_orders;
    CREATE TRIGGER trg_hub_orders_updated  BEFORE UPDATE ON public.hub_orders  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- ============================================================
-- Helper: any internal staff role
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.is_active = true
      AND ur.status = 'active'
      AND ur.role::text IN ('admin','employee','technician','supervisor','sales','kyc_agent','billing_admin','techops','support','field_sales')
  );
$$;

-- ============================================================
-- RLS — enable on all new tables
-- ============================================================
ALTER TABLE public.hub_posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_tickets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_ticket_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_reactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_contests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_faq              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_directory        ENABLE ROW LEVEL SECURITY;

-- hub_posts
DROP POLICY IF EXISTS hub_posts_select_staff ON public.hub_posts;
CREATE POLICY hub_posts_select_staff ON public.hub_posts FOR SELECT
  USING (is_published = true AND public.is_internal_staff(auth.uid()));
DROP POLICY IF EXISTS hub_posts_admin_all ON public.hub_posts;
CREATE POLICY hub_posts_admin_all ON public.hub_posts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- hub_tickets
DROP POLICY IF EXISTS hub_tickets_select_own ON public.hub_tickets;
CREATE POLICY hub_tickets_select_own ON public.hub_tickets FOR SELECT
  USING (submitted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS hub_tickets_insert_own ON public.hub_tickets;
CREATE POLICY hub_tickets_insert_own ON public.hub_tickets FOR INSERT
  WITH CHECK (submitted_by = auth.uid() AND public.is_internal_staff(auth.uid()));
DROP POLICY IF EXISTS hub_tickets_admin_update ON public.hub_tickets;
CREATE POLICY hub_tickets_admin_update ON public.hub_tickets FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS hub_tickets_admin_delete ON public.hub_tickets;
CREATE POLICY hub_tickets_admin_delete ON public.hub_tickets FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- hub_ticket_messages
DROP POLICY IF EXISTS hub_ticket_msgs_select ON public.hub_ticket_messages;
CREATE POLICY hub_ticket_msgs_select ON public.hub_ticket_messages FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.hub_tickets t WHERE t.id = ticket_id AND t.submitted_by = auth.uid() AND is_internal = false)
  );
DROP POLICY IF EXISTS hub_ticket_msgs_insert ON public.hub_ticket_messages;
CREATE POLICY hub_ticket_msgs_insert ON public.hub_ticket_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.hub_tickets t WHERE t.id = ticket_id AND t.submitted_by = auth.uid())
    )
  );

-- hub_reactions
DROP POLICY IF EXISTS hub_reactions_select_staff ON public.hub_reactions;
CREATE POLICY hub_reactions_select_staff ON public.hub_reactions FOR SELECT
  USING (public.is_internal_staff(auth.uid()));
DROP POLICY IF EXISTS hub_reactions_insert_own ON public.hub_reactions;
CREATE POLICY hub_reactions_insert_own ON public.hub_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_internal_staff(auth.uid()));
DROP POLICY IF EXISTS hub_reactions_delete_own ON public.hub_reactions;
CREATE POLICY hub_reactions_delete_own ON public.hub_reactions FOR DELETE
  USING (user_id = auth.uid());

-- hub_notifications
DROP POLICY IF EXISTS hub_notifications_select_staff ON public.hub_notifications;
CREATE POLICY hub_notifications_select_staff ON public.hub_notifications FOR SELECT
  USING (public.is_internal_staff(auth.uid()));
DROP POLICY IF EXISTS hub_notifications_admin_all ON public.hub_notifications;
CREATE POLICY hub_notifications_admin_all ON public.hub_notifications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS hub_notifications_mark_read ON public.hub_notifications;
CREATE POLICY hub_notifications_mark_read ON public.hub_notifications FOR UPDATE
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

-- hub_orders
DROP POLICY IF EXISTS hub_orders_select_own ON public.hub_orders;
CREATE POLICY hub_orders_select_own ON public.hub_orders FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS hub_orders_insert_own ON public.hub_orders;
CREATE POLICY hub_orders_insert_own ON public.hub_orders FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_internal_staff(auth.uid()));
DROP POLICY IF EXISTS hub_orders_admin_update ON public.hub_orders;
CREATE POLICY hub_orders_admin_update ON public.hub_orders FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- hub_contests
DROP POLICY IF EXISTS hub_contests_select_staff ON public.hub_contests;
CREATE POLICY hub_contests_select_staff ON public.hub_contests FOR SELECT
  USING (public.is_internal_staff(auth.uid()));
DROP POLICY IF EXISTS hub_contests_admin_all ON public.hub_contests;
CREATE POLICY hub_contests_admin_all ON public.hub_contests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- hub_faq
DROP POLICY IF EXISTS hub_faq_select_staff ON public.hub_faq;
CREATE POLICY hub_faq_select_staff ON public.hub_faq FOR SELECT
  USING (is_published = true AND public.is_internal_staff(auth.uid()));
DROP POLICY IF EXISTS hub_faq_admin_all ON public.hub_faq;
CREATE POLICY hub_faq_admin_all ON public.hub_faq FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- hub_directory
DROP POLICY IF EXISTS hub_directory_select_staff ON public.hub_directory;
CREATE POLICY hub_directory_select_staff ON public.hub_directory FOR SELECT
  USING (is_visible = true AND public.is_internal_staff(auth.uid()));
DROP POLICY IF EXISTS hub_directory_admin_all ON public.hub_directory;
CREATE POLICY hub_directory_admin_all ON public.hub_directory FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));