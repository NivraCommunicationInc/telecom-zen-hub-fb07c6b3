-- FIX: Update RLS policy for ticket_replies INSERT to support owner_user_id
DROP POLICY IF EXISTS "Users can create replies on their tickets" ON public.ticket_replies;

CREATE POLICY "Users can create replies on their tickets"
ON public.ticket_replies
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must own the reply
  auth.uid() = user_id
  AND (
    -- User owns the ticket (user_id OR owner_user_id)
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_id
      AND (st.user_id = auth.uid() OR st.owner_user_id = auth.uid())
    )
    -- OR user is a ticket participant
    OR EXISTS (
      SELECT 1 FROM public.ticket_participants tp
      WHERE tp.ticket_id = ticket_replies.ticket_id
      AND tp.user_id = auth.uid()
    )
    -- OR user is admin/employee (staff can always reply)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
  )
);