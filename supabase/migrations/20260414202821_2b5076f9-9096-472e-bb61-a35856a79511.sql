
-- Restore staff-only tables to realtime publication
-- Their RLS policies already restrict access to admin/employee roles
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_work_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.field_commissions;
