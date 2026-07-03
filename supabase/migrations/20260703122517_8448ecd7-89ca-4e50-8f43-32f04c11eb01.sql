
CREATE OR REPLACE FUNCTION public.get_field_payment_intent_public(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_intent record;
  v_quote  record;
  v_agent_name text;
BEGIN
  SELECT id, quote_id, paypal_approval_url, amount, currency,
         status, customer_email, customer_name, paid_at, expires_at,
         created_at, agent_id, description, line_items,
         signature, consent_flags, client_edits
  INTO v_intent
  FROM public.field_payment_intents
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT id, client_info, services, equipment, discount, activation_fee,
         subtotal, tps, tvq, total, valid_until, install_date, install_mode
  INTO v_quote
  FROM public.field_quotes
  WHERE id = v_intent.quote_id;

  SELECT full_name INTO v_agent_name
  FROM public.profiles
  WHERE user_id = v_intent.agent_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'intent', jsonb_build_object(
      'id', v_intent.id,
      'quote_id', v_intent.quote_id,
      'paypal_approval_url', v_intent.paypal_approval_url,
      'amount', v_intent.amount,
      'currency', v_intent.currency,
      'status', v_intent.status,
      'customer_email', v_intent.customer_email,
      'customer_name', v_intent.customer_name,
      'paid_at', v_intent.paid_at,
      'expires_at', v_intent.expires_at,
      'created_at', v_intent.created_at,
      'description', v_intent.description,
      'line_items', v_intent.line_items,
      'signature', v_intent.signature,
      'consent_flags', v_intent.consent_flags,
      'client_edits', v_intent.client_edits
    ),
    'quote', CASE WHEN v_quote.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_quote.id,
      'client_info', v_quote.client_info,
      'services', v_quote.services,
      'equipment', v_quote.equipment,
      'discount', v_quote.discount,
      'activation_fee', v_quote.activation_fee,
      'subtotal', v_quote.subtotal,
      'tps', v_quote.tps,
      'tvq', v_quote.tvq,
      'total', v_quote.total,
      'valid_until', v_quote.valid_until,
      'install_date', v_quote.install_date,
      'install_mode', v_quote.install_mode
    ) END,
    'agent_name', COALESCE(v_agent_name, 'Nivra Telecom')
  );
END;
$function$;
