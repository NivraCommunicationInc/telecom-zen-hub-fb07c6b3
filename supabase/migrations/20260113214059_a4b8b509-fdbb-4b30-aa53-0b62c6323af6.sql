-- Add RLS policies for referral_attributions and referral_program_settings using admin_users table

-- Referral attributions: Allow admins to view all
DROP POLICY IF EXISTS "Admin via admin_users can view all referral_attributions" ON referral_attributions;
CREATE POLICY "Admin via admin_users can view all referral_attributions"
ON referral_attributions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);

-- Referral attributions: Allow admins to manage
DROP POLICY IF EXISTS "Admin via admin_users can manage referral_attributions" ON referral_attributions;
CREATE POLICY "Admin via admin_users can manage referral_attributions"
ON referral_attributions FOR ALL
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

-- Commission plans: Allow admins to view all (for dropdown selections)
DROP POLICY IF EXISTS "Admin via admin_users can view all commission_plans" ON commission_plans;
CREATE POLICY "Admin via admin_users can view all commission_plans"
ON commission_plans FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);

-- Referral program settings: Allow admins to view/manage
DROP POLICY IF EXISTS "Admin via admin_users can manage referral_program_settings" ON referral_program_settings;
CREATE POLICY "Admin via admin_users can manage referral_program_settings"
ON referral_program_settings FOR ALL
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