-- FIX 5 — Support tickets: assignation à un technicien + filtre internet/technique

-- 1) Colonne d'assignation : user_id du technicien + nom cache pour affichage rapide
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_to text;

CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to_user_id
  ON public.support_tickets(assigned_to_user_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_category_status
  ON public.support_tickets(category, status);

-- 2) RLS : les techniciens peuvent voir et modifier les tickets qui leur sont assignés
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND policyname = 'Technicians can view their assigned tickets'
  ) THEN
    CREATE POLICY "Technicians can view their assigned tickets"
      ON public.support_tickets
      FOR SELECT
      TO authenticated
      USING (
        assigned_to_user_id = auth.uid()
        AND public.has_role(auth.uid(), 'technician'::app_role)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND policyname = 'Technicians can update their assigned tickets'
  ) THEN
    CREATE POLICY "Technicians can update their assigned tickets"
      ON public.support_tickets
      FOR UPDATE
      TO authenticated
      USING (
        assigned_to_user_id = auth.uid()
        AND public.has_role(auth.uid(), 'technician'::app_role)
      );
  END IF;
END $$;