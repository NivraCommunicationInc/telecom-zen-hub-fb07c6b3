-- P0 SECURITY FIX: Secure role elevation with SECURITY INVOKER trigger
-- This migration:
-- 1) Creates is_staff_user() SECURITY DEFINER function (avoids RLS recursion)
-- 2) Replaces validate_role_change() with SECURITY INVOKER version
-- 3) Adds strict RLS on user_roles table

-- Step 1: Create SECURITY DEFINER function to check if user is staff (avoids RLS recursion)
-- This function checks staff_email_allowlist to determine if a user email is staff
CREATE OR REPLACE FUNCTION public.is_staff_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_email_allowlist sal
    JOIN auth.users au ON lower(au.email) = lower(sal.email)
    WHERE au.id = _user_id
  )
$$;

-- Step 2: Drop old trigger first
DROP TRIGGER IF EXISTS tr_validate_role_change ON public.user_roles;

-- Step 3: Replace validate_role_change() with SECURITY INVOKER version
-- CRITICAL: Only allows staff role changes when current_user = 'service_role'
CREATE OR REPLACE FUNCTION public.validate_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER  -- NOT DEFINER - this is critical for security
SET search_path = public
AS $$
DECLARE
  v_new_role text;
  v_is_staff_role boolean;
BEGIN
  -- Determine which role we're dealing with
  IF TG_OP = 'INSERT' THEN
    v_new_role := NEW.role::text;
  ELSIF TG_OP = 'UPDATE' THEN
    v_new_role := NEW.role::text;
  ELSE
    -- DELETE operations are handled by RLS, not this trigger
    RETURN OLD;
  END IF;

  -- Check if this is a staff role (admin, employee, technician)
  v_is_staff_role := v_new_role IN ('admin', 'employee', 'technician');

  -- If attempting to set a staff role, ONLY allow if current_user is 'service_role'
  -- This is the ONLY reliable check - current_user cannot be spoofed
  IF v_is_staff_role THEN
    IF current_user != 'service_role' THEN
      -- Log the blocked attempt
      INSERT INTO public.security_events (event_type, severity, description, metadata)
      VALUES (
        'blocked_role_elevation',
        'critical',
        format('Blocked attempt to set role %s - current_user is %s, not service_role', v_new_role, current_user),
        jsonb_build_object(
          'user_id', NEW.user_id,
          'attempted_role', v_new_role,
          'current_user', current_user,
          'operation', TG_OP
        )
      );
      
      -- HARD BLOCK - raise exception
      RAISE EXCEPTION 'SECURITY VIOLATION: Only service_role can assign staff roles (admin/employee/technician). Current user: %, Attempted role: %', current_user, v_new_role;
    END IF;
    
    -- Log successful staff role assignment (only reaches here if service_role)
    INSERT INTO public.security_events (event_type, severity, description, metadata)
    VALUES (
      'staff_role_assigned',
      'info',
      format('Staff role %s assigned via service_role', v_new_role),
      jsonb_build_object(
        'user_id', NEW.user_id,
        'role', v_new_role,
        'operation', TG_OP
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Step 4: Re-create trigger with SECURITY INVOKER function
CREATE TRIGGER tr_validate_role_change
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_change();

-- Step 5: Drop existing RLS policies on user_roles
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role manages roles" ON public.user_roles;
DROP POLICY IF EXISTS "block_authenticated_role_changes" ON public.user_roles;
DROP POLICY IF EXISTS "block_anon_role_changes" ON public.user_roles;

-- Step 6: Enable RLS on user_roles (if not already)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 7: Create strict RLS policies for user_roles
-- Policy 1: Users can SELECT their own role only
CREATE POLICY "user_can_read_own_role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy 2: Staff users can SELECT all roles (needed for admin UI)
-- Uses is_staff_user() SECURITY DEFINER function to avoid recursion
CREATE POLICY "staff_can_read_all_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_staff_user(auth.uid()));

-- Policy 3: BLOCK all INSERT from authenticated users (trigger will also block, belt & suspenders)
CREATE POLICY "block_authenticated_insert"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Policy 4: BLOCK all UPDATE from authenticated users
CREATE POLICY "block_authenticated_update"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Policy 5: BLOCK all DELETE from authenticated users
CREATE POLICY "block_authenticated_delete"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);

-- Policy 6: BLOCK all operations from anon
CREATE POLICY "block_anon_all"
ON public.user_roles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Add comment explaining security model
COMMENT ON TABLE public.user_roles IS 'SECURITY: Role assignments. Only service_role can INSERT/UPDATE/DELETE. Authenticated users can only SELECT their own role. Staff can SELECT all roles for admin UI. Trigger validate_role_change() enforces service_role requirement for staff roles.';
COMMENT ON FUNCTION public.validate_role_change() IS 'SECURITY INVOKER trigger - blocks staff role assignment unless current_user = service_role. Cannot be bypassed.';