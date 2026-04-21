-- Recréer la vue avec security_invoker pour respecter RLS de l'appelant
DROP VIEW IF EXISTS public.order_lifecycle;

CREATE VIEW public.order_lifecycle
WITH (security_invoker = true) AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.user_id,
  o.status AS order_status,
  o.payment_status,
  o.installation_type,
  public.is_self_install_order(o.installation_type) AS is_self_install,
  o.created_at AS order_created_at,
  o.shipped_at,
  o.appointment_date,
  s.id AS shipment_id,
  s.status::text AS shipment_status,
  s.tracking_number,
  s.carrier,
  s.tracking_url,
  s.actual_ship_date,
  s.actual_delivery_date,
  ar.id AS activation_request_id,
  ar.status AS activation_status,
  ar.activated_at,
  ar.completed_at AS activation_completed_at,
  CASE
    WHEN ar.status = 'completed' OR o.status = 'activated' THEN 6
    WHEN public.is_self_install_order(o.installation_type) THEN
      CASE
        WHEN ar.status IN ('in_progress','started') THEN 5
        WHEN s.status::text = 'delivered' THEN 5
        WHEN s.status::text IN ('shipped','in_transit','out_for_delivery') THEN 4
        WHEN o.status IN ('processing','preparing','ready_to_ship') THEN 3
        WHEN o.payment_status = 'paid' THEN 2
        ELSE 1
      END
    ELSE
      CASE
        WHEN ar.status IN ('in_progress','started') THEN 5
        WHEN o.appointment_date IS NOT NULL THEN 4
        WHEN o.status IN ('processing','preparing') THEN 3
        WHEN o.payment_status = 'paid' THEN 2
        ELSE 1
      END
  END AS current_step,
  CASE
    WHEN ar.status = 'completed' OR o.status = 'activated' THEN 100
    WHEN public.is_self_install_order(o.installation_type) THEN
      CASE
        WHEN ar.status IN ('in_progress','started') THEN 83
        WHEN s.status::text = 'delivered' THEN 83
        WHEN s.status::text IN ('shipped','in_transit','out_for_delivery') THEN 67
        WHEN o.status IN ('processing','preparing','ready_to_ship') THEN 50
        WHEN o.payment_status = 'paid' THEN 33
        ELSE 17
      END
    ELSE
      CASE
        WHEN ar.status IN ('in_progress','started') THEN 83
        WHEN o.appointment_date IS NOT NULL THEN 67
        WHEN o.status IN ('processing','preparing') THEN 50
        WHEN o.payment_status = 'paid' THEN 33
        ELSE 17
      END
  END AS progress_percent
FROM public.orders o
LEFT JOIN LATERAL (
  SELECT * FROM public.shipments s2 WHERE s2.order_id = o.id
  ORDER BY s2.created_at DESC LIMIT 1
) s ON true
LEFT JOIN LATERAL (
  SELECT * FROM public.activation_requests ar2 WHERE ar2.order_id = o.id
  ORDER BY ar2.submitted_at DESC NULLS LAST LIMIT 1
) ar ON true;

GRANT SELECT ON public.order_lifecycle TO authenticated, anon;