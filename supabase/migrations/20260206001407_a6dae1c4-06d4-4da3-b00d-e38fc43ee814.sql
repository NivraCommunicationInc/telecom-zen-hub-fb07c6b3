-- Update the admin user to NOT require password/pin change
UPDATE user_roles 
SET require_password_change = false, require_pin_change = false 
WHERE user_id = 'cc9e952a-62d6-4b0c-bded-91f4b2d9ea8f' AND role = 'admin';

-- Fix search_path for the function
ALTER FUNCTION validate_role_change() SET search_path = public;