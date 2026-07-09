DELETE FROM public.email_queue WHERE template_key='service_move_requested';
DELETE FROM public.service_change_requests WHERE client_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2' AND change_type='move';
DELETE FROM public.admin_audit_log WHERE action IN ('service_move_requested','service_move_cancelled');
DELETE FROM public.client_activity_logs WHERE client_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2' AND action_type='service_change' AND (summary LIKE 'Demande de transfert%');
DELETE FROM public.client_internal_notes WHERE client_id='d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2' AND body LIKE '[SERVICE.MOVE%';