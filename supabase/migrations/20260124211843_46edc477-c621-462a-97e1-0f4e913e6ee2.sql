-- ============================================================================
-- TICKET COLLABORATIVE SYSTEM + ATTACHMENTS + ADMIN NOTIFICATION SETTINGS
-- ============================================================================

-- 1. TICKET PARTICIPANTS TABLE (for CC employees/technicians)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ticket_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_email TEXT,
  user_name TEXT,
  role TEXT NOT NULL DEFAULT 'participant', -- 'owner', 'assignee', 'participant', 'cc'
  can_reply BOOLEAN DEFAULT true,
  can_reassign BOOLEAN DEFAULT false,
  added_by UUID,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(ticket_id, user_id)
);

ALTER TABLE public.ticket_participants ENABLE ROW LEVEL SECURITY;

-- RLS: Participants can see their participation
CREATE POLICY "Users can see their own participations"
  ON public.ticket_participants FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Admins/employees can manage participants
CREATE POLICY "Staff can manage ticket participants"
  ON public.ticket_participants FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
  );

-- 2. UPDATE TICKET_REPLIES TO SUPPORT ATTACHMENTS
-- ============================================================================
ALTER TABLE public.ticket_replies 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_internal_note BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sender_name TEXT,
ADD COLUMN IF NOT EXISTS sender_role TEXT;

-- 3. TICKET ATTACHMENTS TABLE (for secure file tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  reply_id UUID REFERENCES public.ticket_replies(id) ON DELETE SET NULL,
  uploader_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  storage_bucket TEXT DEFAULT 'ticket-attachments',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see attachments on their tickets
CREATE POLICY "Users can view their ticket attachments"
  ON public.ticket_attachments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.ticket_participants WHERE ticket_id = ticket_attachments.ticket_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
  );

-- RLS: Users can upload to their tickets
CREATE POLICY "Users can upload to their tickets"
  ON public.ticket_attachments FOR INSERT
  WITH CHECK (
    auth.uid() = uploader_id
    AND (
      EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.ticket_participants WHERE ticket_id = ticket_attachments.ticket_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
      OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
    )
  );

-- 4. ADMIN NOTIFICATION SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_label TEXT NOT NULL,
  category TEXT NOT NULL, -- 'tickets', 'orders', 'billing', 'employees', 'partners'
  is_enabled BOOLEAN DEFAULT true,
  email_recipients TEXT[] DEFAULT '{}', -- admin emails to notify
  rate_limit_per_hour INTEGER DEFAULT 50,
  use_digest BOOLEAN DEFAULT false,
  digest_interval_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.admin_notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can view/edit
CREATE POLICY "Admins can manage notification settings"
  ON public.admin_notification_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true));

-- Insert default notification settings
INSERT INTO public.admin_notification_settings (setting_key, setting_label, category, is_enabled) VALUES
  -- Tickets
  ('ticket_created', 'Nouveau ticket client', 'tickets', true),
  ('ticket_reply_client', 'Réponse client sur ticket', 'tickets', true),
  ('ticket_escalated', 'Ticket escaladé', 'tickets', true),
  -- Orders
  ('order_created', 'Nouvelle commande', 'orders', true),
  ('order_status_changed', 'Statut commande modifié', 'orders', false),
  -- Billing
  ('invoice_overdue', 'Facture impayée / en retard', 'billing', true),
  ('payment_failed', 'Échec de paiement', 'billing', true),
  ('payment_confirmed', 'Paiement confirmé', 'billing', false),
  -- Channels
  ('channel_change_requested', 'Demande modification chaînes', 'channels', true),
  -- Employees
  ('employee_blocked', 'Employé bloqué', 'employees', true),
  ('employee_pending', 'Compte employé en attente', 'employees', true),
  -- Partners
  ('partner_cashout_requested', 'Demande retrait partenaire', 'partners', true),
  ('partner_signup', 'Nouveau partenaire inscrit', 'partners', true)
ON CONFLICT (setting_key) DO NOTHING;

-- 5. UPDATE SUPPORT_TICKETS RLS TO INCLUDE PARTICIPANTS
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
CREATE POLICY "Users can view their own tickets or participated"
  ON public.support_tickets FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = owner_user_id
    OR EXISTS (SELECT 1 FROM public.ticket_participants WHERE ticket_id = support_tickets.id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view replies on their tickets" ON public.ticket_replies;
CREATE POLICY "Users can view replies on their tickets or participated"
  ON public.ticket_replies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND (user_id = auth.uid() OR owner_user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.ticket_participants WHERE ticket_id = ticket_replies.ticket_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
  );

-- 6. CREATE STORAGE BUCKET FOR TICKET ATTACHMENTS (50 MB limit)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  false,
  52428800, -- 50 MB
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET 
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- Storage RLS: Users can upload to their ticket folders
CREATE POLICY "Users can upload ticket attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND auth.uid() IS NOT NULL
  );

-- Storage RLS: Users can view their ticket attachments  
CREATE POLICY "Users can view ticket attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ticket-attachments'
    AND auth.uid() IS NOT NULL
  );

-- 7. ENABLE REALTIME FOR TICKET TABLES
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_attachments;