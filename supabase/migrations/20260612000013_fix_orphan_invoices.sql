-- AUDIT FIX RA-2 + RA-3: Fix 2 billing integrity issues
-- A) Create missing invoice for active subscription 72b1bfa5 (INTERNET-500-UNLTD, $59.99/month)
-- B) Create invoice for orphan payment I-E5KRMTG13XYS ($89.99 received, no invoice found)
--    and apply the orphan payment to it

DO $$
DECLARE
  v_invoice_a_id UUID;
  v_invoice_b_id UUID;
  v_invoice_number_a TEXT;
  v_invoice_number_b TEXT;
  v_subtotal_a NUMERIC := 59.99;
  v_tps_a NUMERIC := ROUND(59.99 * 0.05, 2);         -- $3.00
  v_tvq_a NUMERIC := ROUND(59.99 * 0.09975, 2);      -- $5.98
  v_total_a NUMERIC;
  v_subtotal_b NUMERIC := 78.27;  -- 89.99 / 1.14975 rounded
  v_tps_b NUMERIC := ROUND(78.27 * 0.05, 2);         -- $3.91
  v_tvq_b NUMERIC := ROUND(78.27 * 0.09975, 2);      -- $7.81
  v_total_b NUMERIC;
BEGIN
  v_total_a := v_subtotal_a + v_tps_a + v_tvq_a;
  v_total_b := v_subtotal_b + v_tps_b + v_tvq_b;

  -- Generate sequential invoice numbers
  SELECT 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
         LPAD((COALESCE((SELECT MAX(CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER))
                          FROM billing_invoices
                          WHERE invoice_number ~ '^INV-[0-9]{4}-[0-9]+$'), 0) + 1)::TEXT, 5, '0')
  INTO v_invoice_number_a;

  -- A) Invoice for sub 72b1bfa5 (Demo Nivra, Internet 500, June 2026)
  INSERT INTO public.billing_invoices (
    id, subscription_id, customer_id, invoice_number, type,
    subtotal, tps_amount, tvq_amount, total,
    currency, status, cycle_start_date, cycle_end_date,
    due_date, amount_paid, balance_due
  ) VALUES (
    gen_random_uuid(),
    '72b1bfa5-3b70-4d57-9d07-d1bc9372d47b',
    'cb773126-5232-49bc-b3b5-c11cd96c3f94',
    v_invoice_number_a,
    'renewal',
    v_subtotal_a, v_tps_a, v_tvq_a, v_total_a,
    'CAD', 'pending',
    '2026-06-01', '2026-06-30',
    '2026-06-15',
    0, v_total_a
  )
  RETURNING id INTO v_invoice_a_id;

  -- Generate next invoice number
  SELECT 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
         LPAD((COALESCE((SELECT MAX(CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER))
                          FROM billing_invoices
                          WHERE invoice_number ~ '^INV-[0-9]{4}-[0-9]+$'), 0) + 1)::TEXT, 5, '0')
  INTO v_invoice_number_b;

  -- B) Invoice for sub 56391e93 (GIGA+TV, I-E5KRMTG13XYS, June 2026)
  INSERT INTO public.billing_invoices (
    id, subscription_id, customer_id, invoice_number, type,
    subtotal, tps_amount, tvq_amount, total,
    currency, status, cycle_start_date, cycle_end_date,
    due_date, amount_paid, balance_due, payment_method
  ) VALUES (
    gen_random_uuid(),
    '56391e93-45f0-4bdd-ac2e-efa109fe119d',
    'c4fe1514-264c-4cbf-9833-baeac138b2f6',
    v_invoice_number_b,
    'renewal',
    v_subtotal_b, v_tps_b, v_tvq_b, v_total_b,
    'CAD', 'pending',
    '2026-06-01', '2026-06-30',
    '2026-06-15',
    0, v_total_b,
    'paypal'
  )
  RETURNING id INTO v_invoice_b_id;

  -- Apply the orphan payment ($89.99) to invoice B
  INSERT INTO public.billing_payments (
    id, invoice_id, customer_id, amount, method, provider,
    provider_payment_id, status, received_at, source, note
  ) VALUES (
    gen_random_uuid(),
    v_invoice_b_id,
    'c4fe1514-264c-4cbf-9833-baeac138b2f6',
    89.99,
    'paypal', 'paypal',
    '6GH592785J9481234',  -- original PayPal transaction ID
    'confirmed',
    NOW(),
    'system_audit',
    'Payment recovered from orphan_recurring_payment alert — PayPal sub I-E5KRMTG13XYS'
  );

  -- Update invoice B with partial payment
  UPDATE public.billing_invoices
    SET amount_paid = 89.99,
        balance_due = GREATEST(0, v_total_b - 89.99),
        status = CASE WHEN v_total_b <= 89.99 THEN 'paid' ELSE 'pending' END
    WHERE id = v_invoice_b_id;

  -- Resolve the orphan_recurring_payment alert
  UPDATE public.billing_system_alerts
    SET resolved = true,
        resolved_at = NOW(),
        resolved_by = NULL,
        resolution_note = 'Invoice created (' || v_invoice_number_b || ') and payment of $89.99 applied. Remaining balance due.'
    WHERE id = 'ce986476-18cf-4c45-ba71-8ef2ca13f14d';

  RAISE NOTICE 'Invoice A created: % (id=%)', v_invoice_number_a, v_invoice_a_id;
  RAISE NOTICE 'Invoice B created: % (id=%)', v_invoice_number_b, v_invoice_b_id;
END;
$$;
