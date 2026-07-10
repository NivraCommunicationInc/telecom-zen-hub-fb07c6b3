
-- MODULE 33 — PHASE C — Audit / Idempotence

-- F33-18 policies cleanup
DROP POLICY IF EXISTS "Admin can manage ledger" ON public.commission_ledger_entries;
DROP POLICY IF EXISTS "Admin via admin_users can view all commission_ledger_entries" ON public.commission_ledger_entries;
DROP POLICY IF EXISTS "Admins can manage commission_ledger_entries" ON public.commission_ledger_entries;
CREATE POLICY "staff_manage_commission_ledger"
  ON public.commission_ledger_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'billing_admin'::app_role)
      OR public.has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'billing_admin'::app_role)
           OR public.has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Admin can manage attributions" ON public.referral_attributions;
DROP POLICY IF EXISTS "Admin via admin_users can manage referral_attributions" ON public.referral_attributions;
DROP POLICY IF EXISTS "Admin via admin_users can view all referral_attributions" ON public.referral_attributions;
DROP POLICY IF EXISTS "Admins can manage referral_attributions" ON public.referral_attributions;
DROP POLICY IF EXISTS "Clients can insert own referral attributions" ON public.referral_attributions;
DROP POLICY IF EXISTS "Clients can view their own referral usage" ON public.referral_attributions;
DROP POLICY IF EXISTS "Influencers can view own attributions" ON public.referral_attributions;
CREATE POLICY "staff_manage_referral_attributions"
  ON public.referral_attributions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
      OR public.has_role(auth.uid(), 'billing_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'supervisor'::app_role)
           OR public.has_role(auth.uid(), 'billing_admin'::app_role));
CREATE POLICY "clients_view_own_attributions"
  ON public.referral_attributions FOR SELECT TO authenticated
  USING (customer_id = auth.uid());
CREATE POLICY "influencers_view_own_attributions"
  ON public.referral_attributions FOR SELECT TO authenticated
  USING (influencer_id = public.get_influencer_id(auth.uid()));

DROP POLICY IF EXISTS "Admin can manage referral codes" ON public.referral_codes;
DROP POLICY IF EXISTS "Admin via admin_users can manage referral_codes" ON public.referral_codes;
DROP POLICY IF EXISTS "Admin via admin_users can view all referral_codes" ON public.referral_codes;
DROP POLICY IF EXISTS "Admins can manage referral_codes" ON public.referral_codes;
DROP POLICY IF EXISTS "Influencers can view own codes" ON public.referral_codes;
CREATE POLICY "staff_manage_referral_codes"
  ON public.referral_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "influencers_view_own_codes"
  ON public.referral_codes FOR SELECT TO authenticated
  USING (influencer_id = public.get_influencer_id(auth.uid()));
CREATE POLICY "clients_view_own_referral_code"
  ON public.referral_codes FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Admin via admin_users can manage referral_program_settings" ON public.referral_program_settings;
DROP POLICY IF EXISTS "Admins can manage referral_program_settings" ON public.referral_program_settings;

-- F33-14 ledger transitions
CREATE TABLE IF NOT EXISTS public.commission_ledger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.commission_ledger_entries(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  actor_id UUID,
  reason TEXT,
  event_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_commission_ledger_events_event_key
  ON public.commission_ledger_events(event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_ledger_events_entry ON public.commission_ledger_events(entry_id);

GRANT SELECT ON public.commission_ledger_events TO authenticated;
GRANT ALL ON public.commission_ledger_events TO service_role;
ALTER TABLE public.commission_ledger_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_view_commission_ledger_events"
  ON public.commission_ledger_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'supervisor'::app_role)
      OR public.has_role(auth.uid(), 'billing_admin'::app_role));

CREATE OR REPLACE FUNCTION public.rpc_commission_ledger_transition(
  p_entry_id UUID,
  p_target_status TEXT,
  p_actor_id UUID,
  p_reason TEXT,
  p_event_key TEXT
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_valid_targets TEXT[] := ARRAY['approved','reversed','paid'];
  v_existing UUID;
BEGIN
  IF NOT (p_target_status = ANY(v_valid_targets)) THEN
    RAISE EXCEPTION 'Cible invalide: %', p_target_status;
  END IF;

  IF p_event_key IS NOT NULL AND p_event_key <> '' THEN
    SELECT id INTO v_existing FROM public.commission_ledger_events
      WHERE event_key = p_event_key LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true);
    END IF;
  END IF;

  SELECT * INTO v_entry FROM public.commission_ledger_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ledger entry introuvable: %', p_entry_id;
  END IF;

  IF v_entry.status = p_target_status THEN
    INSERT INTO public.commission_ledger_events(entry_id, old_status, new_status, actor_id, reason, event_key)
      VALUES (p_entry_id, v_entry.status, p_target_status, p_actor_id, COALESCE(p_reason,'no-op'), p_event_key);
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;

  IF NOT (
       (v_entry.status = 'pending'  AND p_target_status IN ('approved','reversed'))
    OR (v_entry.status = 'approved' AND p_target_status IN ('reversed','paid'))
    OR (v_entry.status = 'reversed' AND p_target_status = 'approved')
  ) THEN
    RAISE EXCEPTION 'Transition interdite: % -> %', v_entry.status, p_target_status;
  END IF;

  IF p_target_status IN ('reversed','approved') AND COALESCE(TRIM(p_reason),'') = '' THEN
    RAISE EXCEPTION 'Raison requise pour transition vers %', p_target_status;
  END IF;

  UPDATE public.commission_ledger_entries
    SET status = p_target_status,
        approved_at = CASE WHEN p_target_status='approved' THEN now() ELSE approved_at END
    WHERE id = p_entry_id;

  INSERT INTO public.commission_ledger_events(entry_id, old_status, new_status, actor_id, reason, event_key)
    VALUES (p_entry_id, v_entry.status, p_target_status, p_actor_id, p_reason, p_event_key);

  RETURN jsonb_build_object('ok', true, 'from', v_entry.status, 'to', p_target_status);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_commission_ledger_transition(UUID,TEXT,UUID,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_commission_ledger_transition(UUID,TEXT,UUID,TEXT,TEXT) TO service_role;
