-- ============================================================================
-- Cleanup staff_notifications : supprimer les notifications orphelines
-- ============================================================================
-- Suite au cleanup des données test (Vincent only), beaucoup de notifications
-- pointent vers des entités supprimées (order/invoice/payment/subscription).
-- On supprime uniquement celles dont l'entité référencée n'existe plus.
-- Les notifications sans entity_type (commission, payroll, tax) sont conservées.
-- ============================================================================

DELETE FROM public.staff_notifications sn
WHERE entity_type = 'order'
  AND entity_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = sn.entity_id);

DELETE FROM public.staff_notifications sn
WHERE entity_type = 'invoice'
  AND entity_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.billing_invoices bi WHERE bi.id = sn.entity_id);

DELETE FROM public.staff_notifications sn
WHERE entity_type = 'payment'
  AND entity_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.billing_payments bp WHERE bp.id = sn.entity_id);

DELETE FROM public.staff_notifications sn
WHERE entity_type = 'subscription'
  AND entity_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.billing_subscriptions bs WHERE bs.id = sn.entity_id);