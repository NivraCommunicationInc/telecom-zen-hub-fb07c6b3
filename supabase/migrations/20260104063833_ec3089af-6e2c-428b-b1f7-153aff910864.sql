-- Ajouter next_invoice_date à la table accounts
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS next_invoice_date date;

-- Ajouter billing_anchor_date pour référence
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS billing_anchor_date date;

-- Créer une fonction pour calculer la prochaine date de facturation avec règle 29/30/31
CREATE OR REPLACE FUNCTION public.calculate_next_invoice_date(
  p_billing_day integer,
  p_from_date date DEFAULT CURRENT_DATE
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
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

-- Créer un trigger pour définir billing_cycle_day et next_invoice_date à la création du compte
CREATE OR REPLACE FUNCTION public.set_account_billing_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si billing_cycle_day n'est pas défini, utiliser le jour de création
  IF NEW.billing_cycle_day IS NULL THEN
    NEW.billing_cycle_day := EXTRACT(DAY FROM NEW.created_at);
  END IF;
  
  -- Définir la date d'ancrage
  IF NEW.billing_anchor_date IS NULL THEN
    NEW.billing_anchor_date := NEW.created_at::date;
  END IF;
  
  -- Calculer la prochaine date de facturation
  IF NEW.next_invoice_date IS NULL THEN
    NEW.next_invoice_date := NEW.created_at::date; -- Première facture le jour de création
  END IF;
  
  RETURN NEW;
END;
$$;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trigger_set_account_billing_cycle ON public.accounts;

-- Créer le trigger
CREATE TRIGGER trigger_set_account_billing_cycle
  BEFORE INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_account_billing_cycle();

-- Mettre à jour les comptes existants qui n'ont pas de next_invoice_date
UPDATE public.accounts
SET 
  billing_anchor_date = created_at::date,
  next_invoice_date = calculate_next_invoice_date(
    COALESCE(billing_cycle_day, EXTRACT(DAY FROM created_at)::integer),
    CURRENT_DATE
  )
WHERE next_invoice_date IS NULL;