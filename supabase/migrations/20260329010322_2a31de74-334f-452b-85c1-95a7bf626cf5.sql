CREATE POLICY "admins_insert_staff_notif" ON public.staff_notifications
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));