
-- ============================================
-- SECURITY FIX: Additional RLS DENY policies for anon
-- ============================================

-- Ensure fulfillment_snapshots blocks anon
DROP POLICY IF EXISTS "Deny anonymous access to fulfillment_snapshots" ON public.fulfillment_snapshots;
CREATE POLICY "Deny anonymous access to fulfillment_snapshots" 
ON public.fulfillment_snapshots FOR ALL TO anon USING (false);

-- Ensure equipment_order_lines blocks anon
DROP POLICY IF EXISTS "Deny anonymous access to equipment_order_lines" ON public.equipment_order_lines;
CREATE POLICY "Deny anonymous access to equipment_order_lines" 
ON public.equipment_order_lines FOR ALL TO anon USING (false);
