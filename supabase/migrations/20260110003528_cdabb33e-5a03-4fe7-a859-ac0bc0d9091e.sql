-- =====================================================
-- SECURITY HARDENING: Add "Deny anonymous access" policies 
-- to sensitive tables that are missing this protection
-- =====================================================

-- payments table - contains financial transaction data
CREATE POLICY "Deny anonymous access to payments"
ON public.payments
FOR ALL
TO anon
USING (false);

-- payment_disputes table - contains dispute information
CREATE POLICY "Deny anonymous access to payment_disputes"
ON public.payment_disputes
FOR ALL
TO anon
USING (false);

-- payment_proofs table - contains payment verification data
CREATE POLICY "Deny anonymous access to payment_proofs"
ON public.payment_proofs
FOR ALL
TO anon
USING (false);

-- crypto_payments table - contains cryptocurrency payment data
CREATE POLICY "Deny anonymous access to crypto_payments"
ON public.crypto_payments
FOR ALL
TO anon
USING (false);

-- notifications table - contains user notifications
CREATE POLICY "Deny anonymous access to notifications"
ON public.notifications
FOR ALL
TO anon
USING (false);

-- services table - contains service configurations
CREATE POLICY "Deny anonymous access to services"
ON public.services
FOR ALL
TO anon
USING (false);

-- internal_tickets table - contains internal staff tickets
CREATE POLICY "Deny anonymous access to internal_tickets"
ON public.internal_tickets
FOR ALL
TO anon
USING (false);

-- internal_ticket_replies table
CREATE POLICY "Deny anonymous access to internal_ticket_replies"
ON public.internal_ticket_replies
FOR ALL
TO anon
USING (false);

-- ticket_replies table - contains support ticket communications
CREATE POLICY "Deny anonymous access to ticket_replies"
ON public.ticket_replies
FOR ALL
TO anon
USING (false);

-- request_replies table
CREATE POLICY "Deny anonymous access to request_replies"
ON public.request_replies
FOR ALL
TO anon
USING (false);

-- security_incidents table - highly sensitive
CREATE POLICY "Deny anonymous access to security_incidents"
ON public.security_incidents
FOR ALL
TO anon
USING (false);

-- security_action_logs table - highly sensitive
CREATE POLICY "Deny anonymous access to security_action_logs"
ON public.security_action_logs
FOR ALL
TO anon
USING (false);

-- admin_audit_log table - admin activities
CREATE POLICY "Deny anonymous access to admin_audit_log"
ON public.admin_audit_log
FOR ALL
TO anon
USING (false);

-- admin_security_audit table
CREATE POLICY "Deny anonymous access to admin_security_audit"
ON public.admin_security_audit
FOR ALL
TO anon
USING (false);

-- admin_users table
CREATE POLICY "Deny anonymous access to admin_users"
ON public.admin_users
FOR ALL
TO anon
USING (false);

-- employee audit and operations tables
CREATE POLICY "Deny anonymous access to employee_audit_logs"
ON public.employee_audit_logs
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to employee_operations_audit"
ON public.employee_operations_audit
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to employee_pin_attempts"
ON public.employee_pin_attempts
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to employee_pin_lockouts"
ON public.employee_pin_lockouts
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to employee_pin_unlocks"
ON public.employee_pin_unlocks
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to employee_recorded_payments"
ON public.employee_recorded_payments
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to employee_search_rate_limits"
ON public.employee_search_rate_limits
FOR ALL
TO anon
USING (false);

-- client sensitive data tables
CREATE POLICY "Deny anonymous access to client_access_logs"
ON public.client_access_logs
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to client_billing_preferences"
ON public.client_billing_preferences
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to client_login_pins"
ON public.client_login_pins
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to client_pin_logs"
ON public.client_pin_logs
FOR ALL
TO anon
USING (false);

-- channel activity logs
CREATE POLICY "Deny anonymous access to channel_activity_logs"
ON public.channel_activity_logs
FOR ALL
TO anon
USING (false);

-- chatbot logs
CREATE POLICY "Deny anonymous access to chatbot_logs"
ON public.chatbot_logs
FOR ALL
TO anon
USING (false);

-- email queue
CREATE POLICY "Deny anonymous access to email_queue"
ON public.email_queue
FOR ALL
TO anon
USING (false);

-- inventory items
CREATE POLICY "Deny anonymous access to inventory_items"
ON public.inventory_items
FOR ALL
TO anon
USING (false);

-- monthly invoice lines
CREATE POLICY "Deny anonymous access to monthly_invoice_lines"
ON public.monthly_invoice_lines
FOR ALL
TO anon
USING (false);

-- order documents
CREATE POLICY "Deny anonymous access to order_documents"
ON public.order_documents
FOR ALL
TO anon
USING (false);

-- order snapshots
CREATE POLICY "Deny anonymous access to order_snapshots"
ON public.order_snapshots
FOR ALL
TO anon
USING (false);

-- payment gateway settings
CREATE POLICY "Deny anonymous access to payment_gateway_settings"
ON public.payment_gateway_settings
FOR ALL
TO anon
USING (false);

-- payment requests
CREATE POLICY "Deny anonymous access to payment_requests"
ON public.payment_requests
FOR ALL
TO anon
USING (false);

-- pin invite tokens
CREATE POLICY "Deny anonymous access to pin_invite_tokens"
ON public.pin_invite_tokens
FOR ALL
TO anon
USING (false);

-- promotions and redemptions
CREATE POLICY "Deny anonymous access to promotions"
ON public.promotions
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to promotion_redemptions"
ON public.promotion_redemptions
FOR ALL
TO anon
USING (false);

-- rate limiting tables
CREATE POLICY "Deny anonymous access to rate_limit_attempts"
ON public.rate_limit_attempts
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to rate_limit_lockouts"
ON public.rate_limit_lockouts
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to rate_limits"
ON public.rate_limits
FOR ALL
TO anon
USING (false);

-- replacement related tables
CREATE POLICY "Deny anonymous access to replacement_order_items"
ON public.replacement_order_items
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to replacement_orders"
ON public.replacement_orders
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to replacement_shipments"
ON public.replacement_shipments
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to replacement_tickets"
ON public.replacement_tickets
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to replacement_timeline"
ON public.replacement_timeline
FOR ALL
TO anon
USING (false);

-- service cancellation requests
CREATE POLICY "Deny anonymous access to service_cancellation_requests"
ON public.service_cancellation_requests
FOR ALL
TO anon
USING (false);

-- service status
CREATE POLICY "Deny anonymous access to service_status"
ON public.service_status
FOR ALL
TO anon
USING (false);

-- staff OTP codes
CREATE POLICY "Deny anonymous access to staff_otp_codes"
ON public.staff_otp_codes
FOR ALL
TO anon
USING (false);

-- streaming catalog tables
CREATE POLICY "Deny anonymous access to streaming_catalog"
ON public.streaming_catalog
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to streaming_catalog_audit_logs"
ON public.streaming_catalog_audit_logs
FOR ALL
TO anon
USING (false);

-- telecom analytics
CREATE POLICY "Deny anonymous access to telecom_analytics"
ON public.telecom_analytics
FOR ALL
TO anon
USING (false);

-- user_roles table - critical for RBAC
CREATE POLICY "Deny anonymous access to user_roles"
ON public.user_roles
FOR ALL
TO anon
USING (false);

-- work order tables
CREATE POLICY "Deny anonymous access to work_order_files"
ON public.work_order_files
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to work_order_updates"
ON public.work_order_updates
FOR ALL
TO anon
USING (false);

-- crypto IPN logs
CREATE POLICY "Deny anonymous access to crypto_ipn_logs"
ON public.crypto_ipn_logs
FOR ALL
TO anon
USING (false);