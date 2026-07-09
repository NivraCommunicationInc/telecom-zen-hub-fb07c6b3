
DELETE FROM public.email_queue WHERE to_email='test-c360-planchange@nivra-test.ca' AND template_key IN ('service_freeze_cycle_requested','service_trial_extension_requested','service_billing_hold_requested');
DELETE FROM public.client_internal_notes WHERE client_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2' AND body LIKE '[SERVICE.%';
DELETE FROM public.client_activity_logs WHERE client_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2' AND entity_type='service' AND summary ILIKE '%portée%';
DELETE FROM public.admin_audit_log WHERE target_type='service_change_request' AND target_id IN (SELECT id FROM public.service_change_requests WHERE account_id='6c163bc0-0831-40d9-a27f-91b80d59a73a' AND change_type IN ('freeze_cycle','trial_extension','billing_hold'));
DELETE FROM public.service_change_requests WHERE account_id='6c163bc0-0831-40d9-a27f-91b80d59a73a' AND change_type IN ('freeze_cycle','trial_extension','billing_hold');
DELETE FROM public.account_tags WHERE account_id='6c163bc0-0831-40d9-a27f-91b80d59a73a' AND tag_key IN ('freeze_cycle','trial_extension','billing_hold');
