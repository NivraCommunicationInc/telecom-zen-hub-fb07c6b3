
-- STEP 1: Add columns
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS square_customer_id TEXT;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS external_reference TEXT;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS call_status TEXT DEFAULT 'not_called';
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS call_attempts INTEGER DEFAULT 0;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMPTZ;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS last_called_by UUID;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS callback_scheduled_at TIMESTAMPTZ;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS call_notes TEXT;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS locked_by UUID;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS territory TEXT;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 2;

-- Constraints (drop & recreate to be idempotent)
ALTER TABLE public.crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_call_status_check;
ALTER TABLE public.crm_contacts ADD CONSTRAINT crm_contacts_call_status_check
  CHECK (call_status IN ('not_called','in_progress','called','no_answer','message_left','not_interested','do_not_call','sold','callback'));

ALTER TABLE public.crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_priority_check;
ALTER TABLE public.crm_contacts ADD CONSTRAINT crm_contacts_priority_check
  CHECK (priority BETWEEN 1 AND 5);

-- Indexes for hot paths
CREATE INDEX IF NOT EXISTS idx_crm_contacts_call_status ON public.crm_contacts(call_status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_assigned_to ON public.crm_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_is_locked ON public.crm_contacts(is_locked) WHERE is_locked = true;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_square_customer_id ON public.crm_contacts(square_customer_id);

-- STEP 2: Lock / Unlock functions
CREATE OR REPLACE FUNCTION public.lock_crm_contact(p_contact_id UUID, p_agent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locker_name TEXT;
  v_locked_at TIMESTAMPTZ;
BEGIN
  SELECT p.full_name, c.locked_at
    INTO v_locker_name, v_locked_at
  FROM public.crm_contacts c
  LEFT JOIN public.profiles p ON p.user_id = c.locked_by
  WHERE c.id = p_contact_id
    AND c.is_locked = true
    AND c.locked_by IS NOT NULL
    AND c.locked_by <> p_agent_id
    AND c.locked_at > now() - INTERVAL '30 minutes';

  IF v_locker_name IS NOT NULL OR v_locked_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'En appel par ' || COALESCE(v_locker_name, 'un autre agent'),
      'locked_by_name', v_locker_name,
      'locked_at', v_locked_at
    );
  END IF;

  UPDATE public.crm_contacts
     SET is_locked = true,
         locked_by = p_agent_id,
         locked_at = now()
   WHERE id = p_contact_id;

  RETURN jsonb_build_object('success', true, 'message', 'Contact verrouillé');
END;
$$;

CREATE OR REPLACE FUNCTION public.unlock_crm_contact(p_contact_id UUID, p_agent_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.crm_contacts
     SET is_locked = false,
         locked_by = NULL,
         locked_at = NULL
   WHERE id = p_contact_id
     AND locked_by = p_agent_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_crm_contact(UUID, UUID) FROM public;
REVOKE ALL ON FUNCTION public.unlock_crm_contact(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.lock_crm_contact(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_crm_contact(UUID, UUID) TO authenticated;

-- STEP 3: Realtime publication
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_contacts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_contacts';
  END IF;
END $$;
ALTER TABLE public.crm_contacts REPLICA IDENTITY FULL;

-- STEP 4: RLS policies
DROP POLICY IF EXISTS "Internal staff can view crm_contacts" ON public.crm_contacts;
CREATE POLICY "Internal staff can view crm_contacts"
ON public.crm_contacts FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
);

DROP POLICY IF EXISTS "Staff can update assigned crm_contacts" ON public.crm_contacts;
CREATE POLICY "Staff can update assigned crm_contacts"
ON public.crm_contacts FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'employee'::app_role)
      OR has_role(auth.uid(), 'field_sales'::app_role)
      OR has_role(auth.uid(), 'sales'::app_role)
      OR has_role(auth.uid(), 'supervisor'::app_role))
    AND (
      assigned_to = auth.uid()
      OR locked_by = auth.uid()
      OR assigned_to IS NULL
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
);
