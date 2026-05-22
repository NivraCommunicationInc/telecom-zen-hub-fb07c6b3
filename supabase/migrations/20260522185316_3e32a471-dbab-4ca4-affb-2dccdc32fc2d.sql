
-- 1) NPS surveys: remove permissive anon UPDATE; submission now goes through edge function
DROP POLICY IF EXISTS "Public submit nps via token" ON public.nps_surveys;

-- 2) tech_can_access_order: ensure technician_assignment belongs to the calling user
CREATE OR REPLACE FUNCTION public.tech_can_access_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'employee')
      OR public.has_role(auth.uid(), 'supervisor')
      OR public.has_role(auth.uid(), 'techops')
      OR EXISTS (
        SELECT 1
        FROM public.technician_assignments ta
        JOIN public.technicians t ON t.id = ta.technician_id
        WHERE ta.order_id = p_order_id
          AND t.user_id = auth.uid()
      )
    );
$function$;

-- 3) realtime.messages: replace wildcard authenticated SELECT with a topic-scoped policy
DROP POLICY IF EXISTS "authenticated_can_receive_broadcasts" ON realtime.messages;

CREATE POLICY "authenticated_user_scoped_broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE ('private-' || (auth.uid())::text || '-%')
  OR realtime.topic() LIKE ('user-' || (auth.uid())::text || '-%')
);
