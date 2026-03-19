
-- ============================================
-- Phase 3: Operational Automation Tables
-- ============================================

-- 1. Work items: unified operational queue with SLA tracking and assignment
CREATE TABLE public.employee_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('order','payment','kyc','activation','ticket')),
  source_id uuid NOT NULL,
  source_reference text,
  client_id uuid,
  client_name text,
  client_email text,
  team text NOT NULL CHECK (team IN ('orders','billing','verification','activation','support')),
  assigned_to_id uuid,
  assigned_to_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','escalated','completed','cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  sla_status text NOT NULL DEFAULT 'on_time' CHECK (sla_status IN ('on_time','at_risk','breached')),
  sla_deadline_at timestamptz,
  sla_breached_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (item_type, source_id)
);

ALTER TABLE public.employee_work_items ENABLE ROW LEVEL SECURITY;

-- Staff can read all work items
CREATE POLICY "Staff can read work items"
  ON public.employee_work_items FOR SELECT
  TO authenticated
  USING (true);

-- Staff can update work items (assignment, status, notes)
CREATE POLICY "Staff can update work items"
  ON public.employee_work_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- System/edge functions can insert work items
CREATE POLICY "System can insert work items"
  ON public.employee_work_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime for work items
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_work_items;

-- 2. Employee notifications
CREATE TABLE public.employee_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('assignment','urgent','sla_breach','escalation','system')),
  title text NOT NULL,
  message text,
  work_item_id uuid REFERENCES public.employee_work_items(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "Users read own notifications"
  ON public.employee_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark read)
CREATE POLICY "Users update own notifications"
  ON public.employee_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System can insert notifications
CREATE POLICY "System can insert notifications"
  ON public.employee_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_notifications;

-- 3. Assignment rules config
CREATE TABLE public.assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL,
  team text NOT NULL,
  sla_hours integer NOT NULL DEFAULT 24,
  at_risk_hours integer NOT NULL DEFAULT 18,
  auto_assign boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_type)
);

ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read assignment rules"
  ON public.assignment_rules FOR SELECT
  TO authenticated
  USING (true);

-- Seed default rules
INSERT INTO public.assignment_rules (item_type, team, sla_hours, at_risk_hours) VALUES
  ('order', 'orders', 24, 18),
  ('payment', 'billing', 12, 8),
  ('kyc', 'verification', 24, 18),
  ('activation', 'activation', 48, 36),
  ('ticket', 'support', 24, 18);

-- 4. Index for performance
CREATE INDEX idx_work_items_status ON public.employee_work_items(status) WHERE status NOT IN ('completed','cancelled');
CREATE INDEX idx_work_items_team ON public.employee_work_items(team, status);
CREATE INDEX idx_work_items_assigned ON public.employee_work_items(assigned_to_id) WHERE assigned_to_id IS NOT NULL;
CREATE INDEX idx_work_items_sla ON public.employee_work_items(sla_status) WHERE sla_status != 'on_time';
CREATE INDEX idx_employee_notifications_user ON public.employee_notifications(user_id, is_read);
