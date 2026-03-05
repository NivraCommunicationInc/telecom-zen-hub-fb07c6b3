-- ============================================================
-- PHASE 1: SECURITY & RLS STANDARDIZATION
-- ============================================================

-- 1. CREDIT_CLASS PROTECTION TRIGGER (Blocks client updates)
CREATE OR REPLACE FUNCTION public.trg_block_credit_class_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.credit_class IS DISTINCT FROM NEW.credit_class THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'employee'::public.app_role)
    ) THEN
      RAISE EXCEPTION 'CREDIT_CLASS_UPDATE_DENIED: Only staff can modify credit_class';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_credit_class_update ON public.accounts;
CREATE TRIGGER trg_block_credit_class_update
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_block_credit_class_update();

-- 2. ANONYMOUS ACCESS RESTRICTIVE POLICY (all critical tables)
DROP POLICY IF EXISTS "Deny anonymous access to accounts" ON public.accounts;
CREATE POLICY "deny_anon_accounts" ON public.accounts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. STANDARDIZE ALL RLS POLICIES: is_admin() / is_admin_user() / is_staff() -> has_role()

-- === account_access_logs ===
DROP POLICY IF EXISTS "Admins can view access logs" ON public.account_access_logs;
CREATE POLICY "staff_view_access_logs" ON public.account_access_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === accounts (admin-only legacy) ===
DROP POLICY IF EXISTS "Admin only - accounts" ON public.accounts;

-- === admin_secret_audit_log ===
DROP POLICY IF EXISTS "Only admins can view secret audit logs" ON public.admin_secret_audit_log;
CREATE POLICY "admins_view_secret_audit" ON public.admin_secret_audit_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- === admin_security_audit ===
DROP POLICY IF EXISTS "Only admins can view security audit" ON public.admin_security_audit;
CREATE POLICY "admins_view_security_audit" ON public.admin_security_audit
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- === admin_users ===
DROP POLICY IF EXISTS "Only admins can manage admin_users" ON public.admin_users;
CREATE POLICY "admins_manage_admin_users" ON public.admin_users
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- === appointments ===
DROP POLICY IF EXISTS "Admin only - appointments" ON public.appointments;
CREATE POLICY "staff_manage_appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === authorized_users ===
DROP POLICY IF EXISTS "Admin only - authorized_users" ON public.authorized_users;
CREATE POLICY "staff_manage_authorized_users" ON public.authorized_users
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === billing ===
DROP POLICY IF EXISTS "Admin only - billing" ON public.billing;
CREATE POLICY "staff_manage_billing" ON public.billing
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === billing_customers ===
DROP POLICY IF EXISTS "Admins full access billing_customers" ON public.billing_customers;
CREATE POLICY "staff_manage_billing_customers" ON public.billing_customers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === billing_invoice_lines ===
DROP POLICY IF EXISTS "Admins full access billing_invoice_lines" ON public.billing_invoice_lines;
CREATE POLICY "staff_manage_billing_invoice_lines" ON public.billing_invoice_lines
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === billing_invoices ===
DROP POLICY IF EXISTS "Admins full access billing_invoices" ON public.billing_invoices;
CREATE POLICY "staff_manage_billing_invoices" ON public.billing_invoices
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === billing_payments ===
DROP POLICY IF EXISTS "Admins full access billing_payments" ON public.billing_payments;
CREATE POLICY "staff_manage_billing_payments" ON public.billing_payments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === billing_subscriptions ===
DROP POLICY IF EXISTS "Admins full access billing_subscriptions" ON public.billing_subscriptions;
CREATE POLICY "staff_manage_billing_subscriptions" ON public.billing_subscriptions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === cashout_requests ===
DROP POLICY IF EXISTS "Admin can manage cashouts" ON public.cashout_requests;
CREATE POLICY "staff_manage_cashouts" ON public.cashout_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === channel_selections ===
DROP POLICY IF EXISTS "Admin only - channel_selections" ON public.channel_selections;
CREATE POLICY "staff_manage_channel_selections" ON public.channel_selections
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === client_internal_notes ===
DROP POLICY IF EXISTS "Admin only - client_internal_notes" ON public.client_internal_notes;
CREATE POLICY "staff_manage_client_notes" ON public.client_internal_notes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === client_login_pins ===
DROP POLICY IF EXISTS "Admin only - client_login_pins" ON public.client_login_pins;
CREATE POLICY "staff_manage_client_pins" ON public.client_login_pins
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === client_notification_logs ===
DROP POLICY IF EXISTS "Admins can view client notification logs" ON public.client_notification_logs;
CREATE POLICY "staff_view_client_notif_logs" ON public.client_notification_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === client_streaming_subscriptions ===
DROP POLICY IF EXISTS "Admin only - client_streaming_subscriptions" ON public.client_streaming_subscriptions;
CREATE POLICY "staff_manage_streaming_subs" ON public.client_streaming_subscriptions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === contracts ===
DROP POLICY IF EXISTS "Admin only - contracts" ON public.contracts;
CREATE POLICY "staff_manage_contracts" ON public.contracts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === crypto_ipn_logs ===
DROP POLICY IF EXISTS "Admin full access to crypto_ipn_logs" ON public.crypto_ipn_logs;
CREATE POLICY "staff_manage_crypto_ipn" ON public.crypto_ipn_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === crypto_payments ===
DROP POLICY IF EXISTS "Admin full access to crypto_payments" ON public.crypto_payments;
CREATE POLICY "staff_manage_crypto_payments" ON public.crypto_payments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === email_events ===
DROP POLICY IF EXISTS "Admins can view email events" ON public.email_events;
CREATE POLICY "staff_view_email_events" ON public.email_events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === employee_operations_audit ===
DROP POLICY IF EXISTS "Staff can view operations audit" ON public.employee_operations_audit;
CREATE POLICY "staff_view_ops_audit" ON public.employee_operations_audit
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === employee_pin_attempts ===
DROP POLICY IF EXISTS "Staff can log PIN attempts" ON public.employee_pin_attempts;
CREATE POLICY "staff_log_pin_attempts" ON public.employee_pin_attempts
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === employee_pin_unlocks ===
DROP POLICY IF EXISTS "Staff can create unlocks" ON public.employee_pin_unlocks;
DROP POLICY IF EXISTS "Staff can update unlocks" ON public.employee_pin_unlocks;
DROP POLICY IF EXISTS "Staff can view unlocks" ON public.employee_pin_unlocks;
CREATE POLICY "staff_view_pin_unlocks" ON public.employee_pin_unlocks
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "staff_insert_pin_unlocks" ON public.employee_pin_unlocks
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "staff_update_pin_unlocks" ON public.employee_pin_unlocks
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === field_sales_cashout_requests ===
DROP POLICY IF EXISTS "Admins can manage all cashout requests" ON public.field_sales_cashout_requests;
CREATE POLICY "staff_manage_field_cashouts" ON public.field_sales_cashout_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === field_sales_commission_rules ===
DROP POLICY IF EXISTS "Admins can manage commission rules" ON public.field_sales_commission_rules;
CREATE POLICY "admins_manage_commission_rules" ON public.field_sales_commission_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- === identity_verification_sessions ===
DROP POLICY IF EXISTS "Admins can read all sessions" ON public.identity_verification_sessions;
DROP POLICY IF EXISTS "Admins can update all sessions" ON public.identity_verification_sessions;
CREATE POLICY "staff_read_verification_sessions" ON public.identity_verification_sessions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "staff_update_verification_sessions" ON public.identity_verification_sessions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === influencer_payouts ===
DROP POLICY IF EXISTS "Admin can manage payouts" ON public.influencer_payouts;
CREATE POLICY "staff_manage_payouts" ON public.influencer_payouts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === ledger_entries ===
DROP POLICY IF EXISTS "Admin only - ledger_entries" ON public.ledger_entries;
CREATE POLICY "staff_manage_ledger" ON public.ledger_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === monthly_invoices ===
DROP POLICY IF EXISTS "Admin only - monthly_invoices" ON public.monthly_invoices;
CREATE POLICY "staff_manage_monthly_invoices" ON public.monthly_invoices
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === notifications ===
DROP POLICY IF EXISTS "Admin only - notifications" ON public.notifications;
CREATE POLICY "staff_manage_notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === orders ===
DROP POLICY IF EXISTS "Admin only - orders" ON public.orders;
CREATE POLICY "staff_manage_orders" ON public.orders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === payment_disputes ===
DROP POLICY IF EXISTS "Admin only - payment_disputes" ON public.payment_disputes;
CREATE POLICY "staff_manage_disputes" ON public.payment_disputes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === payment_gateway_settings ===
DROP POLICY IF EXISTS "Admin full access to payment_gateway_settings" ON public.payment_gateway_settings;
CREATE POLICY "admins_manage_gateway_settings" ON public.payment_gateway_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- === payment_methods ===
DROP POLICY IF EXISTS "Admin archive only - payment_methods" ON public.payment_methods;
CREATE POLICY "staff_view_payment_methods" ON public.payment_methods
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === payment_requests ===
DROP POLICY IF EXISTS "Admins can manage all payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Admin only - payment_requests" ON public.payment_requests;
CREATE POLICY "staff_manage_payment_requests" ON public.payment_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === profiles ===
DROP POLICY IF EXISTS "Admin only - profiles" ON public.profiles;
CREATE POLICY "staff_manage_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === referral_program_settings ===
DROP POLICY IF EXISTS "Admin can manage settings" ON public.referral_program_settings;
CREATE POLICY "admins_manage_referral_settings" ON public.referral_program_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- === replacement_request_tickets ===
DROP POLICY IF EXISTS "Admin only - replacement_request_tickets" ON public.replacement_request_tickets;
CREATE POLICY "staff_manage_replacement_tickets" ON public.replacement_request_tickets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === service_cancellation_requests ===
DROP POLICY IF EXISTS "Admin only - service_cancellation_requests" ON public.service_cancellation_requests;
CREATE POLICY "staff_manage_cancellations" ON public.service_cancellation_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === services ===
DROP POLICY IF EXISTS "Admins can fully manage services" ON public.services;
CREATE POLICY "staff_manage_services" ON public.services
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === staff_notifications ===
DROP POLICY IF EXISTS "Admins can mark notifications as read" ON public.staff_notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.staff_notifications;
CREATE POLICY "staff_view_staff_notif" ON public.staff_notifications
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "staff_update_staff_notif" ON public.staff_notifications
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === support_tickets ===
DROP POLICY IF EXISTS "Admin only - support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "staff_roles_can_view_all_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "staff_roles_can_insert_tickets" ON public.support_tickets;
CREATE POLICY "staff_view_tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "staff_insert_tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "staff_update_tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "staff_delete_tickets" ON public.support_tickets
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- === ticket_replies ===
DROP POLICY IF EXISTS "admin_users_can_insert_replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "staff_roles_can_insert_replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "staff_roles_can_view_all_replies" ON public.ticket_replies;
CREATE POLICY "staff_view_replies" ON public.ticket_replies
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
CREATE POLICY "staff_insert_replies" ON public.ticket_replies
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === user_roles ===
DROP POLICY IF EXISTS "Admin only - user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "staff_can_read_all_roles" ON public.user_roles;
CREATE POLICY "admins_manage_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "staff_read_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- === work_orders ===
DROP POLICY IF EXISTS "Admin only - work_orders" ON public.work_orders;
CREATE POLICY "staff_manage_work_orders" ON public.work_orders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

-- 4. DROP LEGACY AUTH FUNCTIONS
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_staff();
DROP FUNCTION IF EXISTS public.is_admin_user(uuid);
DROP FUNCTION IF EXISTS public.is_admin_user();