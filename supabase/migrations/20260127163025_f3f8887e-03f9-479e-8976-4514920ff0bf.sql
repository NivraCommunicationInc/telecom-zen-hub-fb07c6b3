-- Fix security issues from previous migration

-- 1. Drop and recreate the view without SECURITY DEFINER issues
DROP VIEW IF EXISTS public.field_sales_leaderboard;

-- Recreate leaderboard as a simple view (uses invoker's permissions)
CREATE VIEW public.field_sales_leaderboard 
WITH (security_invoker = true) AS
SELECT 
  ur.user_id,
  p.full_name,
  p.email,
  COUNT(DISTINCT fso.id) as total_sales,
  COALESCE(SUM(fso.total_amount), 0) as total_revenue,
  COALESCE(SUM(sc.commission_amount), 0) as total_commissions,
  COALESCE(SUM(sc.bonus_amount), 0) as total_bonuses,
  COUNT(DISTINCT CASE WHEN fso.created_at >= CURRENT_DATE THEN fso.id END) as sales_today,
  COUNT(DISTINCT CASE WHEN fso.created_at >= date_trunc('week', CURRENT_DATE) THEN fso.id END) as sales_this_week,
  COUNT(DISTINCT CASE WHEN fso.created_at >= date_trunc('month', CURRENT_DATE) THEN fso.id END) as sales_this_month
FROM public.user_roles ur
JOIN public.profiles p ON p.user_id = ur.user_id
LEFT JOIN public.field_sales_orders fso ON fso.salesperson_id = ur.user_id
LEFT JOIN public.sales_commissions sc ON sc.salesperson_id = ur.user_id
WHERE ur.role = 'field_sales' AND ur.is_active = true
GROUP BY ur.user_id, p.full_name, p.email
ORDER BY total_sales DESC;

-- 2. Fix the function with proper search_path
CREATE OR REPLACE FUNCTION public.generate_cashout_request_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.request_number := 'CO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::TEXT, 1, 4);
  RETURN NEW;
END;
$$;