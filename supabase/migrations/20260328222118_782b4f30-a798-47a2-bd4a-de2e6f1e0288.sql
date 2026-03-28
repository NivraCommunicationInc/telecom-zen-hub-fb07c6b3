-- Bug #4: Add UPDATE policy for agents to cancel their own withdrawal requests
CREATE POLICY "agents_update_own_withdrawals"
ON public.commission_withdrawal_requests
FOR UPDATE
TO authenticated
USING (agent_id = auth.uid())
WITH CHECK (agent_id = auth.uid());