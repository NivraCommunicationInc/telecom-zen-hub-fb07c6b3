-- AUDIT FIX B-5: Resolve stale billing_system_alerts
-- All 5 open alerts are either 2-year-old test disputes or test subscription references.

-- 1. Dispute PP-D-20240523-001 (2024-06-06 response deadline — expired 2 years ago)
UPDATE public.billing_system_alerts
  SET resolved = true,
      resolved_at = NOW(),
      resolved_by = 'system_audit',
      resolution_note = 'Dispute PP-D-20240523-001 from May 2024 — seller response deadline expired 2024-06-06. Historical record. No action required.'
  WHERE id = 'b8855154-170c-45ad-b870-af08addbd1e3';

-- 2. Dispute PP-D-20240601-003 (2024-06-15 response deadline — expired 2 years ago)
UPDATE public.billing_system_alerts
  SET resolved = true,
      resolved_at = NOW(),
      resolved_by = 'system_audit',
      resolution_note = 'Dispute PP-D-20240601-003 from June 2024 — seller response deadline expired 2024-06-15. Historical record. No action required.'
  WHERE id = '0ec422bd-6c4f-45dc-82cf-52638a73b471';

-- 3. payment_failed for I-CANCELLEDTEST (test reference, not a real subscription)
UPDATE public.billing_system_alerts
  SET resolved = true,
      resolved_at = NOW(),
      resolved_by = 'system_audit',
      resolution_note = 'PayPal subscription I-CANCELLEDTEST is a test reference. Subscription already in correct state (suspended/cancelled). No action required.'
  WHERE id = '2706c3e3-f147-4009-9828-0984a1875325';

-- 4. noc_escalation (auto-escalation of the 2 disputes above — now resolved)
UPDATE public.billing_system_alerts
  SET resolved = true,
      resolved_at = NOW(),
      resolved_by = 'system_audit',
      resolution_note = 'NOC escalation resolved: parent dispute alerts have been reviewed and resolved.'
  WHERE id = '80fe6f0e-6c68-44d3-9d0c-2b4c73440558';

-- 5. orphan_recurring_payment I-E5KRMTG13XYS — create a proper invoice below
-- (Handled in migration 20260612000013)
