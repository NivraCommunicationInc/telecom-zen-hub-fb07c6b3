-- Fix infinite recursion in profiles table RLS policies
-- The issue is caused by policies that reference other tables which in turn reference profiles

-- First, drop all existing policies on profiles to reset
DROP POLICY IF EXISTS "Admin manages profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Client reads own profile" ON public.profiles;
DROP POLICY IF EXISTS "Client updates own profile" ON public.profiles;
DROP POLICY IF EXISTS "Client inserts own profile" ON public.profiles;
DROP POLICY IF EXISTS "Employee reads profiles" ON public.profiles;
DROP POLICY IF EXISTS "Technician views assigned client profiles" ON public.profiles;

-- Recreate simple, non-recursive policies

-- Admin full access
CREATE POLICY "Admin manages all profiles"
ON public.profiles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Client can read their own profile (simple user_id match)
CREATE POLICY "Client reads own profile"
ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Client can update their own profile
CREATE POLICY "Client updates own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Client can insert their own profile
CREATE POLICY "Client inserts own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Employee can read all profiles (simple role check, no table references)
CREATE POLICY "Employee reads all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'employee'::app_role));

-- Technician can read all profiles (simple role check, no table references)
-- This avoids the recursive reference to orders/work_orders/technicians
CREATE POLICY "Technician reads profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'technician'::app_role));