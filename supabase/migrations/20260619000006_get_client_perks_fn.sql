-- BUG N9+N10: Expose active promotions and pending credits to the client portal.
-- Creates a SECURITY DEFINER function callable by authenticated clients.

CREATE OR REPLACE FUNCTION public.get_client_perks(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE client_id = p_user_id
  ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RETURN jsonb_build_object('promotions', '[]'::jsonb, 'adjustments', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'promotions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',              ap.id,
        'label',           ap.label,
        'amount',          ap.amount,
        'months_remaining', ap.months_remaining,
        'duration_months', ap.duration_months,
        'promotion_type',  ap.promotion_type,
        'promo_code',      ap.promo_code,
        'expires_at',      ap.expires_at,
        'is_active',       ap.is_active
      ) ORDER BY ap.created_at DESC)
      FROM public.account_promotions ap
      WHERE ap.account_id = v_account_id
        AND ap.is_active = true
        AND (ap.expires_at IS NULL OR ap.expires_at > now())
        AND (ap.months_remaining IS NULL OR ap.months_remaining > 0)
    ), '[]'::jsonb),
    'adjustments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',              aa.id,
        'description',     aa.description,
        'amount',          aa.amount,
        'months_remaining', aa.months_remaining,
        'months_total',    aa.months_total,
        'is_permanent',    aa.is_permanent,
        'type',            aa.type,
        'expires_at',      aa.expires_at
      ) ORDER BY aa.created_at DESC)
      FROM public.account_adjustments aa
      WHERE aa.account_id = v_account_id
        AND aa.status = 'active'
        AND aa.type IN ('credit', 'first_month_free', 'one_time')
        AND (aa.is_permanent = true OR (aa.months_remaining IS NOT NULL AND aa.months_remaining > 0))
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_perks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_perks(uuid) TO authenticated;
