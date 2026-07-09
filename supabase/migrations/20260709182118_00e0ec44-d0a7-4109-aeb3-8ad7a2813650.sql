
-- Module 16 E2E cleanup
DELETE FROM public.email_queue WHERE to_email ILIKE '%nivra-test.ca%' AND created_at > now() - interval '10 min';
DELETE FROM public.client_activity_logs WHERE client_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2' AND entity_type='equipment' AND created_at > now() - interval '10 min';
DELETE FROM public.client_internal_notes WHERE client_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2' AND body LIKE '[EQUIPMENT.%' AND created_at > now() - interval '10 min';
DELETE FROM public.admin_audit_log WHERE action LIKE 'equipment.%' AND target_id::text='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2' AND created_at > now() - interval '10 min';
DELETE FROM public.equipment_inventory WHERE id IN ('36e5811e-fa7b-4f30-8f8e-cac45718ae62','6b3c24ae-2cc5-4672-9193-3facf395120c');
