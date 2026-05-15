INSERT INTO field_commissions (
  agent_id, order_id, amount, status, commission_type,
  description, earned_at, clawback_eligible_until
)
SELECT
  o.created_by_agent_id, o.id,
  ROUND((COALESCE(fso.total_amount, 0) * 0.30)::numeric, 2),
  'pending', 'forfait',
  'Commission vente terrain — ' || o.order_number,
  o.created_at, o.created_at + INTERVAL '30 days'
FROM orders o
JOIN field_sales_orders fso ON fso.converted_order_id = o.id
WHERE o.source = 'field_sales'
  AND o.created_by_agent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM field_commissions fc
    WHERE fc.order_id = o.id AND fc.commission_type = 'forfait'
  );

DO $$
DECLARE
  r RECORD;
  v_invoice_id uuid;
  v_invoice_number text;
  v_customer_id uuid;
  v_today date := CURRENT_DATE;
  v_event_key text;
BEGIN
  FOR r IN
    SELECT o.id, o.order_number, o.user_id,
           o.client_email, o.client_first_name, o.client_last_name,
           o.client_phone, o.subtotal, o.tps_amount, o.tvq_amount,
           o.total_amount, o.service_type
    FROM orders o
    LEFT JOIN billing_invoices bi ON bi.order_id = o.id
    WHERE o.source = 'field_sales' AND bi.id IS NULL
  LOOP
    SELECT id INTO v_customer_id FROM billing_customers
      WHERE user_id = r.user_id LIMIT 1;
    IF v_customer_id IS NULL THEN
      INSERT INTO billing_customers (user_id, first_name, last_name, email, phone)
      VALUES (r.user_id,
        COALESCE(r.client_first_name, 'Client'),
        COALESCE(r.client_last_name, 'Terrain'),
        r.client_email,
        COALESCE(r.client_phone, '0000000000'))
      RETURNING id INTO v_customer_id;
    END IF;

    v_invoice_number := lpad(((floor(random() * 8) + 2)::int)::text, 1, '0')
                     || lpad((floor(random() * 1000000))::int::text, 6, '0');

    INSERT INTO billing_invoices (
      customer_id, order_id, invoice_number, type,
      subtotal, tps_amount, tvq_amount, total,
      currency, payment_method, status,
      cycle_start_date, cycle_end_date, due_date,
      amount_paid, balance_due, environment, notes
    ) VALUES (
      v_customer_id, r.id, v_invoice_number, 'initial',
      COALESCE(r.subtotal, 0), COALESCE(r.tps_amount, 0),
      COALESCE(r.tvq_amount, 0), COALESCE(r.total_amount, 0),
      'CAD', 'interac'::billing_payment_method,
      'pending',
      v_today, v_today + INTERVAL '30 days', v_today + INTERVAL '30 days',
      0, COALESCE(r.total_amount, 0), 'live',
      'Backfill — Vente terrain ' || r.order_number
    )
    RETURNING id INTO v_invoice_id;

    INSERT INTO billing_invoice_lines (
      invoice_id, description, unit_price, quantity, line_total, line_type
    ) VALUES (
      v_invoice_id,
      COALESCE(r.service_type, 'Service Nivra'),
      COALESCE(r.subtotal, 0), 1, COALESCE(r.subtotal, 0), 'service'
    );

    v_event_key := 'fs_backfill_invoice_' || r.id::text;

    IF NOT EXISTS (SELECT 1 FROM email_queue WHERE idempotency_key = v_event_key) THEN
      INSERT INTO email_queue (
        event_key, to_email, template_key, template_vars,
        status, attempts, max_attempts,
        idempotency_key, message_type, entity_type, entity_id, created_at
      ) VALUES (
        v_event_key, r.client_email, 'order_confirmation',
        jsonb_build_object(
          'clientName', COALESCE(r.client_first_name || ' ' || r.client_last_name, 'Client'),
          'orderNumber', r.order_number,
          'invoiceNumber', v_invoice_number,
          'totalAmount', r.total_amount,
          'orderId', r.id,
          'invoiceId', v_invoice_id
        ),
        'queued', 0, 5,
        v_event_key, 'transactional', 'order', r.id::text, now()
      );
    END IF;
  END LOOP;
END $$;