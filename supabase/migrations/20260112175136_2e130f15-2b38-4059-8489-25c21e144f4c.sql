-- =========================================
-- FIX RLS: influencers (admin insert + self signup)
-- =========================================

ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

-- Nettoyer les policies susceptibles de se contredire (si elles existent)
DROP POLICY IF EXISTS "Admin can manage influencers" ON public.influencers;
DROP POLICY IF EXISTS "Admin can manage influencers (all)" ON public.influencers;
DROP POLICY IF EXISTS "Influencers can read own record" ON public.influencers;
DROP POLICY IF EXISTS "Users can create own influencer record" ON public.influencers;
DROP POLICY IF EXISTS "Influencers can update own record" ON public.influencers;
DROP POLICY IF EXISTS "influencers_admin_employee_all" ON public.influencers;
DROP POLICY IF EXISTS "influencers_self_select" ON public.influencers;
DROP POLICY IF EXISTS "influencers_self_insert_pending" ON public.influencers;
DROP POLICY IF EXISTS "influencers_self_update" ON public.influencers;

-- 1) Admin/Employee: FULL (inclut INSERT via WITH CHECK)
CREATE POLICY "influencers_admin_employee_all"
ON public.influencers
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')
);

-- 2) Influencer: lire son profil
CREATE POLICY "influencers_self_select"
ON public.influencers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3) Self-signup: insert uniquement de SON record en pending
CREATE POLICY "influencers_self_insert_pending"
ON public.influencers
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- 4) Influencer: update uniquement son profil (ex: payout_email)
CREATE POLICY "influencers_self_update"
ON public.influencers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());