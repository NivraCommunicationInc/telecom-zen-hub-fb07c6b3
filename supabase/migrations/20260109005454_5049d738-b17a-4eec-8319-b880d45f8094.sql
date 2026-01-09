-- =====================================================
-- ADMIN-ONLY SECURITY OVERHAUL MIGRATION
-- =====================================================

-- 1. Create admin_users table (primary admin identity table)
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    deactivated_at TIMESTAMPTZ,
    deactivated_by UUID,
    notes TEXT
);

-- Enable RLS on admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 2. Create is_admin() function (security definer to prevent recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND is_active = true
  )
$$;

-- 3. Create payment_requests table for Interac/Crypto manual verification
CREATE TABLE IF NOT EXISTS public.payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.billing(id) ON DELETE SET NULL,
    
    -- Payment details
    method TEXT NOT NULL CHECK (method IN ('interac', 'crypto')),
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'CAD',
    
    -- Reference for verification
    reference_code TEXT NOT NULL,
    client_reference TEXT, -- User-provided reference (e.g., Interac confirmation)
    
    -- Crypto-specific fields
    crypto_currency TEXT, -- BTC, ETH, etc.
    crypto_txid TEXT, -- Transaction ID from blockchain
    crypto_wallet_address TEXT,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending_verification' 
        CHECK (status IN ('pending_verification', 'verified', 'rejected', 'cancelled')),
    
    -- Verification
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.admin_users(id),
    verification_note TEXT,
    rejection_reason TEXT,
    
    -- Instructions shown to client
    payment_instructions TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on payment_requests
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- 4. Admin-only policy for admin_users table
CREATE POLICY "Only admins can manage admin_users" 
ON public.admin_users 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

-- Allow service role to insert (for initial bootstrap)
CREATE POLICY "Service role can manage admin_users"
ON public.admin_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Payment requests policies
-- Clients can view and create their own payment requests
CREATE POLICY "Clients can view their payment requests"
ON public.payment_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Clients can create payment requests"
ON public.payment_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'pending_verification');

CREATE POLICY "Clients can cancel pending payment requests"
ON public.payment_requests
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending_verification')
WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- Admins have full access to payment requests
CREATE POLICY "Admins can manage all payment requests"
ON public.payment_requests
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- 6. Drop all employee/technician related policies and update to admin-only
-- First, drop existing policies that reference employees/technicians

-- accounts table - remove employee/technician policies
DROP POLICY IF EXISTS "Employees can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Technicians can view assigned accounts" ON public.accounts;

-- activity_logs - remove staff policy
DROP POLICY IF EXISTS "Staff can view activity logs" ON public.activity_logs;

-- appointments - remove employee/technician policies  
DROP POLICY IF EXISTS "Employees can manage all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Technicians can view their assigned appointments" ON public.appointments;
DROP POLICY IF EXISTS "Technicians can update appointment status" ON public.appointments;

-- billing - remove employee policy
DROP POLICY IF EXISTS "Employees can view all billing" ON public.billing;

-- profiles - remove employee policy
DROP POLICY IF EXISTS "Employees can view all profiles" ON public.profiles;

-- orders - remove employee/technician policies
DROP POLICY IF EXISTS "Employees can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Technicians can view assigned orders" ON public.orders;

-- account_service_locations - remove employee policy
DROP POLICY IF EXISTS "Employees can view service locations" ON public.account_service_locations;

-- 7. Create admin audit log for critical actions
CREATE TABLE IF NOT EXISTS public.admin_security_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_security_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view security audit"
ON public.admin_security_audit
FOR SELECT
USING (is_admin());

CREATE POLICY "System can insert security audit"
ON public.admin_security_audit
FOR INSERT
WITH CHECK (true);

-- 8. Create updated_at trigger for payment_requests
CREATE OR REPLACE FUNCTION public.update_payment_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_payment_requests_updated_at
BEFORE UPDATE ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_requests_updated_at();

-- 9. Migrate existing admin from user_roles to admin_users
INSERT INTO public.admin_users (user_id, is_active, notes)
SELECT user_id, true, 'Migrated from user_roles'
FROM public.user_roles
WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- 10. Add index for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON public.payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_reference ON public.payment_requests(reference_code);