-- STEP 1: Drop the blocking trigger first
DROP TRIGGER IF EXISTS validate_role_change_trigger ON user_roles;