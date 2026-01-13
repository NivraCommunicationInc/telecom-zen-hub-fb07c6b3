-- Add RLS policies for influencer_payouts using admin_users table

DROP POLICY IF EXISTS "Admin via admin_users can manage influencer_payouts" ON influencer_payouts;
CREATE POLICY "Admin via admin_users can manage influencer_payouts"
ON influencer_payouts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);