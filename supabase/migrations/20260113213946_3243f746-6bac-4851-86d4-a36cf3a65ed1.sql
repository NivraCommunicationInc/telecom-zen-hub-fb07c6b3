-- Add RLS policies for admins using admin_users table (for legacy support)
-- This allows admins logged in through admin portal to access influencer data

-- Drop existing duplicate policies if they exist and recreate
DROP POLICY IF EXISTS "Admin via admin_users can manage influencers" ON influencers;
DROP POLICY IF EXISTS "Admin via admin_users can manage referral_codes" ON referral_codes;
DROP POLICY IF EXISTS "Admin via admin_users can view all influencers" ON influencers;
DROP POLICY IF EXISTS "Admin via admin_users can view all referral_codes" ON referral_codes;
DROP POLICY IF EXISTS "Admin via admin_users can view all commission_ledger_entries" ON commission_ledger_entries;
DROP POLICY IF EXISTS "Admin via admin_users can view all cashout_requests" ON cashout_requests;

-- Influencers: Allow admins to SELECT all
CREATE POLICY "Admin via admin_users can view all influencers"
ON influencers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);

-- Influencers: Allow admins to INSERT/UPDATE/DELETE
CREATE POLICY "Admin via admin_users can manage influencers"
ON influencers FOR ALL
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

-- Referral codes: Allow admins to view all
CREATE POLICY "Admin via admin_users can view all referral_codes"
ON referral_codes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);

-- Referral codes: Allow admins to manage
DROP POLICY IF EXISTS "Admin via admin_users can manage referral_codes" ON referral_codes;
CREATE POLICY "Admin via admin_users can manage referral_codes"
ON referral_codes FOR ALL
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

-- Commission ledger: Allow admins to view all
CREATE POLICY "Admin via admin_users can view all commission_ledger_entries"
ON commission_ledger_entries FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);

-- Cashout requests: Allow admins to view all
CREATE POLICY "Admin via admin_users can view all cashout_requests"
ON cashout_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);