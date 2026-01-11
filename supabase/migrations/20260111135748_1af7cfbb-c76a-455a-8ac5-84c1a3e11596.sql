-- =====================================================
-- HARDENING: Strict validate_payment_created_by - NO AUTO-FILL
-- Remove ALL auto-fill defaults, enforce strict validation
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_payment_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_allowed_roles TEXT[] := ARRAY['admin', 'manager', 'support', 'billing', 'system', 'client'];
  v_finalized_statuses TEXT[] := ARRAY['captured', 'completed', 'processed'];
BEGIN
  -- For ANY finalized payment status, strictly enforce all audit fields
  -- NO AUTO-FILL - callers MUST supply all fields
  IF NEW.status = ANY(v_finalized_statuses) THEN
    
    -- Check created_by_id is present and not the null UUID
    IF NEW.created_by_id IS NULL OR NEW.created_by_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
      RAISE EXCEPTION '[AUDIT_BLOCK] Finalized payment (status=%) requires valid created_by_id. Got: %. Payment ID: %', 
        NEW.status, COALESCE(NEW.created_by_id::text, 'NULL'), COALESCE(NEW.id::text, 'NEW');
    END IF;
    
    -- Check created_by_name is present and not empty
    IF NEW.created_by_name IS NULL OR TRIM(NEW.created_by_name) = '' THEN
      RAISE EXCEPTION '[AUDIT_BLOCK] Finalized payment (status=%) requires created_by_name. Got: %. Payment ID: %', 
        NEW.status, COALESCE(NEW.created_by_name, 'NULL'), COALESCE(NEW.id::text, 'NEW');
    END IF;
    
    -- Check created_by_role is present, not empty, and in allowed list
    IF NEW.created_by_role IS NULL OR TRIM(NEW.created_by_role) = '' THEN
      RAISE EXCEPTION '[AUDIT_BLOCK] Finalized payment (status=%) requires created_by_role. Got: %. Payment ID: %', 
        NEW.status, COALESCE(NEW.created_by_role, 'NULL'), COALESCE(NEW.id::text, 'NEW');
    END IF;
    
    -- Validate role is in allowed list (case-insensitive)
    IF NOT (LOWER(TRIM(NEW.created_by_role)) = ANY(v_allowed_roles)) THEN
      RAISE EXCEPTION '[AUDIT_BLOCK] Invalid created_by_role "%" for finalized payment. Allowed: %. Payment ID: %', 
        NEW.created_by_role, array_to_string(v_allowed_roles, ', '), COALESCE(NEW.id::text, 'NEW');
    END IF;
  END IF;
  
  -- For pending/authorized: no enforcement, allow creation
  -- But ensure source has a value if not provided
  IF NEW.source IS NULL OR TRIM(NEW.source) = '' THEN
    NEW.source := 'manual';
  END IF;

  RETURN NEW;
END;
$$;

-- Add documentation comment
COMMENT ON FUNCTION public.validate_payment_created_by() IS 
'[P0 HARDENING v2] Strictly enforces audit trail on finalized payments.
Blocks ANY payment with status IN (captured, completed, processed) if:
- created_by_id is NULL or 00000000-0000-0000-0000-000000000000
- created_by_name is NULL or empty
- created_by_role is NULL, empty, or not in allowed list
Allowed roles: admin, manager, support, billing, system, client.
NO AUTO-FILL - ALL callers (including webhooks/system) must supply these fields.';