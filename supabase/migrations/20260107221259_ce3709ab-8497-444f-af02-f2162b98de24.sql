-- Add RLS policies for admin/employee access to messaging tables
-- Staff can read all conversations
CREATE POLICY "Staff can view all conversations"
ON public.message_conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'employee') 
    AND ur.status = 'active'
  )
);

-- Staff can update any conversation (status changes, etc.)
CREATE POLICY "Staff can update conversations"
ON public.message_conversations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'employee') 
    AND ur.status = 'active'
  )
);

-- Staff can view all messages (including internal notes)
CREATE POLICY "Staff can view all messages"
ON public.helpdesk_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'employee') 
    AND ur.status = 'active'
  )
);

-- Staff can insert messages (replies)
CREATE POLICY "Staff can send messages"
ON public.helpdesk_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'employee') 
    AND ur.status = 'active'
  )
  AND sender_role IN ('admin', 'employee')
);