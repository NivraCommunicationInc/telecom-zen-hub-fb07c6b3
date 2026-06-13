-- Activation Queue: confirm manual wholesale activation
CREATE OR REPLACE FUNCTION confirm_manual_activation(
  p_order_id       UUID,
  p_admin_id       UUID,
  p_wholesale_ref  TEXT DEFAULT NULL,
  p_notes          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order         orders%ROWTYPE;
  v_sub_id        UUID;
  v_note_append   TEXT;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.status = 'activated' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_activated');
  END IF;

  -- Build internal note
  v_note_append := '[Activation manuelle - ' || NOW()::date || ']';
  IF p_wholesale_ref IS NOT NULL THEN
    v_note_append := v_note_append || ' Réf grossiste: ' || p_wholesale_ref;
  END IF;
  IF p_notes IS NOT NULL THEN
    v_note_append := v_note_append || ' — ' || p_notes;
  END IF;

  -- Update order
  UPDATE orders SET
    status                   = 'activated',
    service_activated_at     = NOW(),
    service_activated_by     = p_admin_id,
    service_activation_source = 'manual_wholesale',
    internal_notes           = CASE
                                 WHEN internal_notes IS NULL THEN v_note_append
                                 ELSE internal_notes || E'\n' || v_note_append
                               END,
    updated_at               = NOW()
  WHERE id = p_order_id;

  -- Activate subscription linked to this order
  UPDATE billing_subscriptions
  SET status     = 'active',
      updated_at = NOW()
  WHERE order_id = p_order_id
  RETURNING id INTO v_sub_id;

  -- Log to provisioning_log
  INSERT INTO provisioning_log (subscription_id, customer_id, action, adapter, trigger, status, details, started_at, completed_at)
  VALUES (
    v_sub_id,
    v_order.account_id,
    'activate',
    'manual_wholesale',
    'admin_confirm',
    'success',
    jsonb_build_object(
      'order_id',       p_order_id,
      'wholesale_ref',  p_wholesale_ref,
      'notes',          p_notes,
      'confirmed_by',   p_admin_id
    ),
    NOW(),
    NOW()
  );

  -- Queue activation email to client
  INSERT INTO email_queue (
    event_key, to_email, template_key, variables,
    entity_type, entity_id, priority, status
  ) VALUES (
    'service_activated_' || p_order_id,
    v_order.client_email,
    'service_activated',
    jsonb_build_object(
      'client_first_name', COALESCE(v_order.client_first_name, 'Client'),
      'service_type',      COALESCE(v_order.service_type, 'Service'),
      'order_number',      COALESCE(v_order.order_number, v_order.id::text),
      'account_id',        v_order.account_id
    ),
    'order',
    p_order_id,
    1,
    'pending'
  )
  ON CONFLICT (event_key) DO NOTHING;

  RETURN jsonb_build_object(
    'success',         true,
    'order_id',        p_order_id,
    'subscription_id', v_sub_id,
    'wholesale_ref',   p_wholesale_ref
  );
END;
$$;

-- Allow authenticated admins to call this
GRANT EXECUTE ON FUNCTION confirm_manual_activation(UUID, UUID, TEXT, TEXT) TO authenticated;

-- View: pending activations (orders paid but not yet activated)
CREATE OR REPLACE VIEW v_pending_activations AS
SELECT
  o.id,
  o.order_number,
  o.created_at,
  o.service_type,
  o.client_first_name,
  o.client_last_name,
  o.client_email,
  o.client_phone,
  o.client_full_address,
  o.total_amount,
  o.payment_status,
  o.amount_paid,
  o.payment_method,
  o.sim_number,
  o.serial_number,
  o.imei_number,
  o.equipment_details,
  o.installation_type,
  o.requested_activation_date,
  o.activation_preference,
  o.internal_notes,
  o.appointment_date,
  o.sla_deadline,
  o.dispatch_priority,
  bs.id          AS subscription_id,
  bs.plan_name,
  bs.plan_price,
  bs.plan_code,
  bs.status      AS subscription_status
FROM orders o
LEFT JOIN billing_subscriptions bs ON bs.order_id = o.id
WHERE o.status = 'active'
  AND o.service_type NOT IN ('support')
ORDER BY
  CASE o.dispatch_priority
    WHEN 'urgent' THEN 1
    WHEN 'high'   THEN 2
    WHEN 'normal' THEN 3
    ELSE 4
  END,
  o.created_at ASC;

GRANT SELECT ON v_pending_activations TO authenticated;
