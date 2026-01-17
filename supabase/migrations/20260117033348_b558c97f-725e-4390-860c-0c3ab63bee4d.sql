-- =============================================
-- NETTOYAGE COMPLET DES DONNÉES DE TEST
-- Ordre respectant les contraintes FK
-- =============================================

-- Désactiver les triggers sur payments
ALTER TABLE public.payments DISABLE TRIGGER trg_validate_payment_created_by;
ALTER TABLE public.payments DISABLE TRIGGER trg_recompute_invoice_on_payment;
ALTER TABLE public.payments DISABLE TRIGGER trigger_create_ledger_on_payment;
ALTER TABLE public.payments DISABLE TRIGGER trigger_prevent_double_payment;
ALTER TABLE public.payments DISABLE TRIGGER trigger_update_invoice_balance;

-- === NIVEAU 1: Tables sans enfants ===

-- Contest winners (dépend de contest_entries)
DELETE FROM public.contest_winners;

-- Payment disputes
DELETE FROM public.payment_disputes;

-- Employee recorded payments
DELETE FROM public.employee_recorded_payments;

-- Payment requests
DELETE FROM public.payment_requests;

-- Ticket replies
DELETE FROM public.ticket_replies;

-- Work order updates
DELETE FROM public.work_order_updates;

-- Order documents
DELETE FROM public.order_documents;

-- Order snapshots
DELETE FROM public.order_snapshots;

-- Fulfillment snapshots
DELETE FROM public.fulfillment_snapshots;

-- Equipment order lines
DELETE FROM public.equipment_order_lines;

-- Streaming activation tokens
DELETE FROM public.streaming_activation_tokens;

-- Mobile fulfillment
DELETE FROM public.mobile_fulfillment;

-- Service instances
DELETE FROM public.service_instances;

-- Messages liées aux orders
UPDATE public.messages SET related_order_id = NULL WHERE related_order_id IS NOT NULL;

-- === NIVEAU 2: Tables intermédiaires ===

-- Payments (dépend de billing + orders)
DELETE FROM public.payments;

-- Payment proofs
DELETE FROM public.payment_proofs;

-- Crypto payments
DELETE FROM public.crypto_payments;
DELETE FROM public.crypto_ipn_logs;

-- Ledger entries
DELETE FROM public.ledger_entries;

-- Contest entries
DELETE FROM public.contest_entries;

-- Work orders (dépend de orders + appointments)
DELETE FROM public.work_orders;

-- Channel selections
DELETE FROM public.channel_selections;

-- Support tickets (dépend de orders)
DELETE FROM public.support_tickets;

-- Replacement orders
DELETE FROM public.replacement_orders;

-- Replacement tickets
DELETE FROM public.replacement_tickets;

-- Replacement internal orders
DELETE FROM public.replacement_internal_orders;

-- Replacement request tickets
DELETE FROM public.replacement_request_tickets;

-- Admin notification logs
DELETE FROM public.admin_notification_logs;

-- === NIVEAU 3: Tables principales ===

-- Appointments (dépend de orders)
DELETE FROM public.appointments;

-- Billing (dépend de orders)
DELETE FROM public.billing;

-- Orders
DELETE FROM public.orders;

-- Contact requests (tickets web)
DELETE FROM public.contact_requests;

-- === NIVEAU 4: Reset des services actifs ===

-- Réinitialiser les subscriptions streaming actives
UPDATE public.client_streaming_subscriptions 
SET status = 'cancelled', 
    cancelled_at = now(), 
    cancellation_reason = 'Reset données test'
WHERE status = 'active';

-- Reset billing preferences dates
UPDATE public.client_billing_preferences 
SET preauth_opt_in_at = NULL 
WHERE preauth_opt_in_at IS NOT NULL;

-- Service cancellation requests
DELETE FROM public.service_cancellation_requests;

-- Réactiver tous les triggers
ALTER TABLE public.payments ENABLE TRIGGER trg_validate_payment_created_by;
ALTER TABLE public.payments ENABLE TRIGGER trg_recompute_invoice_on_payment;
ALTER TABLE public.payments ENABLE TRIGGER trigger_create_ledger_on_payment;
ALTER TABLE public.payments ENABLE TRIGGER trigger_prevent_double_payment;
ALTER TABLE public.payments ENABLE TRIGGER trigger_update_invoice_balance;