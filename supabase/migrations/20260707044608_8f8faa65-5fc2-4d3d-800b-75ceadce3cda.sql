CREATE OR REPLACE FUNCTION public.fn_sync_invoice_financials_from_lines()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_invoice_id  uuid;
  v_snapshot    jsonb;
  v_sum_lines   numeric;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_invoice_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Si la facture est déjà figée par un RPC canonique (tax_snapshot posé),
  -- ne pas recalculer : le subtotal est source de vérité unique et immuable.
  SELECT tax_snapshot INTO v_snapshot
    FROM public.billing_invoices
    WHERE id = v_invoice_id;
  IF v_snapshot IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT ROUND(COALESCE(SUM(line_total), 0)::numeric, 2)
    INTO v_sum_lines
    FROM public.billing_invoice_lines
    WHERE invoice_id = v_invoice_id;

  UPDATE public.billing_invoices bi
    SET subtotal = v_sum_lines
    WHERE bi.id = v_invoice_id;

  RETURN NULL;
END;
$function$;