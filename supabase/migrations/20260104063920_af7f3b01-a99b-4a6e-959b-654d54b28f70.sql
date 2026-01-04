-- Fix search_path for calculate_next_invoice_date function
CREATE OR REPLACE FUNCTION public.calculate_next_invoice_date(
  p_billing_day integer,
  p_from_date date DEFAULT CURRENT_DATE
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_year integer;
  v_month integer;
  v_last_day integer;
  v_actual_day integer;
BEGIN
  -- Si la date de départ est déjà passée pour ce mois, aller au mois suivant
  IF EXTRACT(DAY FROM p_from_date) >= p_billing_day THEN
    v_year := EXTRACT(YEAR FROM p_from_date + INTERVAL '1 month');
    v_month := EXTRACT(MONTH FROM p_from_date + INTERVAL '1 month');
  ELSE
    v_year := EXTRACT(YEAR FROM p_from_date);
    v_month := EXTRACT(MONTH FROM p_from_date);
  END IF;
  
  -- Calculer le dernier jour du mois cible
  v_last_day := EXTRACT(DAY FROM (DATE_TRUNC('MONTH', MAKE_DATE(v_year::integer, v_month::integer, 1)) + INTERVAL '1 month - 1 day'));
  
  -- Appliquer la règle 29/30/31 : prendre le minimum entre billing_day et dernier jour du mois
  v_actual_day := LEAST(p_billing_day, v_last_day);
  
  RETURN MAKE_DATE(v_year::integer, v_month::integer, v_actual_day::integer);
END;
$$;