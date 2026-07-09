
-- QA cleanup Module 15 — Service Mobile
DELETE FROM public.mobile_topups WHERE user_id = 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
DELETE FROM public.sim_actions WHERE user_id = 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
DELETE FROM public.mobile_addons WHERE user_id = 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
DELETE FROM public.mobile_addons WHERE user_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM public.admin_audit_log WHERE action LIKE 'mobile.%' AND admin_user_id = 'cc9e952a-62d6-4b0c-bded-91f4b2d9ea8f';
DELETE FROM public.client_activity_logs WHERE client_id = 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2' AND (summary LIKE 'Recharge mobile%' OR summary LIKE 'Option mobile %' OR summary LIKE 'SIM %');
DELETE FROM public.client_internal_notes WHERE client_id = 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2' AND body LIKE '[MOBILE.%';
DELETE FROM public.email_queue WHERE template_key LIKE 'client_mobile%' AND created_at > now() - interval '2 hour';
