
-- Attendance records for technician punch in/out
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  punch_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  punch_out_at TIMESTAMPTZ,
  total_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date
  ON public.attendance_records(user_id, punch_in_at DESC);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_self_select ON public.attendance_records;
CREATE POLICY attendance_self_select ON public.attendance_records
  FOR SELECT USING (
    user_id = auth.uid()
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'supervisor'::app_role)
    OR has_role(auth.uid(),'techops'::app_role)
  );

DROP POLICY IF EXISTS attendance_self_insert ON public.attendance_records;
CREATE POLICY attendance_self_insert ON public.attendance_records
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS attendance_self_update ON public.attendance_records;
CREATE POLICY attendance_self_update ON public.attendance_records
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger: when installation completed, activate order + create subscription + queue emails
CREATE OR REPLACE FUNCTION public.fn_installation_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_client_email TEXT;
  v_client_first TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Activate the order
    UPDATE public.orders
       SET status = 'completed',
           updated_at = now()
     WHERE id = NEW.order_id
    RETURNING * INTO v_order;

    -- Activate account if any
    IF v_order.account_id IS NOT NULL THEN
      UPDATE public.accounts
         SET status = 'active',
             updated_at = now()
       WHERE id = v_order.account_id;
    END IF;

    -- Lookup client info for email
    SELECT p.email, p.first_name INTO v_client_email, v_client_first
      FROM public.accounts a
      LEFT JOIN public.profiles p ON p.user_id = a.user_id
     WHERE a.id = v_order.account_id;

    IF v_client_email IS NOT NULL THEN
      INSERT INTO public.email_queue (to_email, template_key, template_vars, status, language)
      VALUES (
        v_client_email,
        'tech_completed',
        jsonb_build_object(
          'first_name', COALESCE(v_client_first, 'Client'),
          'plan_name', COALESCE(v_order.plan_name, 'Forfait Nivra'),
          'order_number', v_order.order_number,
          'renewal_date', to_char(now() + INTERVAL '30 days', 'DD/MM/YYYY')
        ),
        'queued',
        'fr'
      );
    END IF;

    INSERT INTO public.email_queue (to_email, template_key, template_vars, status, language)
    VALUES (
      'support@nivra-telecom.ca',
      'tech_completed',
      jsonb_build_object(
        'first_name','Support',
        'order_id', NEW.order_id,
        'assignment_id', NEW.id,
        'order_number', v_order.order_number
      ),
      'queued',
      'fr'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_installation_completed ON public.technician_assignments;
CREATE TRIGGER trg_installation_completed
AFTER UPDATE OF status ON public.technician_assignments
FOR EACH ROW
EXECUTE FUNCTION public.fn_installation_completed();
