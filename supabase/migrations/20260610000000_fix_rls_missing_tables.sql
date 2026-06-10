-- Fix: Enable RLS on all tables flagged by Supabase security advisor
-- Triggered by: security advisory email, 08 Jun 2026
-- These 20 tables had RLS disabled, making them publicly accessible via the anon key.
-- service_role key already bypasses RLS — edge functions are unaffected.

-- ══════════════════════════════════════════════════════════════
-- ADMIN-ONLY TABLES (no client/employee direct access needed)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.applicant_emails          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_audit_trail       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crtc_compliance_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_answers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applicants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_responses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_surveys_sent          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.porting_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_breach_incidents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_violations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_test_tbl         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON public.applicant_emails
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_all" ON public.consent_audit_trail
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_all" ON public.crtc_compliance_reports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_all" ON public.interview_answers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_all" ON public.job_applicants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_all" ON public.nps_responses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_all" ON public.nps_surveys_sent
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_all" ON public.porting_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_all" ON public.privacy_breach_incidents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_all" ON public.sla_violations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_all" ON public.training_test_tbl
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ══════════════════════════════════════════════════════════════
-- HUB TABLES (internal employee hub — staff read + admin write)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.hub_posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_reactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_faq             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_directory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_contests        ENABLE ROW LEVEL SECURITY;

-- hub_posts: staff can read published posts, admin manages all
CREATE POLICY "staff_read_posts" ON public.hub_posts
  FOR SELECT TO authenticated
  USING (is_published = true AND public.is_internal_staff(auth.uid()));
CREATE POLICY "admin_all_posts" ON public.hub_posts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- hub_tickets: staff can view/manage their own tickets, admin manages all
CREATE POLICY "staff_own_tickets" ON public.hub_tickets
  FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR assigned_to = auth.uid() OR public.is_internal_staff(auth.uid()));
CREATE POLICY "staff_insert_tickets" ON public.hub_tickets
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND public.is_internal_staff(auth.uid()));
CREATE POLICY "staff_update_own_tickets" ON public.hub_tickets
  FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND public.is_internal_staff(auth.uid()));
CREATE POLICY "admin_all_tickets" ON public.hub_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- hub_ticket_messages: staff can read/write on tickets they can see
CREATE POLICY "staff_read_ticket_messages" ON public.hub_ticket_messages
  FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "staff_insert_ticket_messages" ON public.hub_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_internal_staff(auth.uid()));
CREATE POLICY "admin_all_ticket_messages" ON public.hub_ticket_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- hub_notifications: staff can read broadcast notifications, admin manages
CREATE POLICY "staff_read_notifications" ON public.hub_notifications
  FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "admin_all_notifications" ON public.hub_notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- hub_orders: staff can manage their own store orders, admin manages all
CREATE POLICY "staff_own_orders" ON public.hub_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "staff_insert_orders" ON public.hub_orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_internal_staff(auth.uid()));
CREATE POLICY "admin_all_orders" ON public.hub_orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- hub_reactions: staff can manage their own reactions
CREATE POLICY "staff_own_reactions" ON public.hub_reactions
  FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "staff_insert_reactions" ON public.hub_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_internal_staff(auth.uid()));
CREATE POLICY "staff_delete_own_reactions" ON public.hub_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "admin_all_reactions" ON public.hub_reactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- hub_faq: staff can read published FAQs, admin manages all
CREATE POLICY "staff_read_faq" ON public.hub_faq
  FOR SELECT TO authenticated
  USING (is_published = true AND public.is_internal_staff(auth.uid()));
CREATE POLICY "admin_all_faq" ON public.hub_faq
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- hub_directory: staff can read visible entries, admin manages all
CREATE POLICY "staff_read_directory" ON public.hub_directory
  FOR SELECT TO authenticated
  USING (is_visible = true AND public.is_internal_staff(auth.uid()));
CREATE POLICY "admin_all_directory" ON public.hub_directory
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- hub_contests: staff can read, admin manages all
CREATE POLICY "staff_read_contests" ON public.hub_contests
  FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "admin_all_contests" ON public.hub_contests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
