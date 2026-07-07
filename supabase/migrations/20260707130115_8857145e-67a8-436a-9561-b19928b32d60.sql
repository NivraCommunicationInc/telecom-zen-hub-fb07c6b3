-- =========================================================================
-- INVARIANT-SUBSCRIPTION-RECURRING-ONLY
-- Garde-fou permanent : refuse tout abonnement dont frozen_name/frozen_code
-- contient un équipement ou frais unique, même si l'order_item source est
-- marqué is_recurring=true (données amont contaminées).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.fn_subscription_recurring_only_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_forbidden_pattern text := '(terminal|borne|router|routeur|wifi router|hardware|équipement|equipement|frais activation|frais d''activation|activation fee|frais installation|frais d''installation|frais déplacement|frais deplacement|déplacement|deplacement|uber|shipping|livraison|frais unique|one[-_ ]?time)';
  v_target text;
  v_is_recurring boolean;
BEGIN
  -- 1) Contenu textuel des snapshots
  FOR v_target IN
    SELECT unnest(ARRAY[
      COALESCE(NEW.frozen_name,''),
      COALESCE(NEW.frozen_code,''),
      COALESCE(NEW.plan_name,''),
      COALESCE(NEW.plan_code,'')
    ])
  LOOP
    IF lower(v_target) ~ v_forbidden_pattern THEN
      RAISE EXCEPTION 'INVARIANT-SUBSCRIPTION-RECURRING-ONLY: le libellé "%" contient un équipement ou un frais unique. Un abonnement doit contenir uniquement des services récurrents (Internet, TV, Mobile, Streaming+). Terminal, Borne, Router, activation, installation, déplacement sont des lignes one-time — elles doivent rester dans la facture initiale via order_items (is_recurring=false).', v_target
        USING ERRCODE = 'check_violation', HINT = 'Nettoyer le plan_name de la ligne order_item source, ou séparer les composants récurrents/non-récurrents en items distincts.';
    END IF;
  END LOOP;

  -- 2) Double-check : la ligne source doit être récurrente (redondant avec fn_subscription_freeze_guard mais explicite)
  IF TG_OP = 'INSERT' AND NEW.source_order_item_id IS NOT NULL THEN
    SELECT is_recurring INTO v_is_recurring FROM public.order_items WHERE id = NEW.source_order_item_id;
    IF v_is_recurring IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INVARIANT-SUBSCRIPTION-RECURRING-ONLY: order_item % n''est pas récurrent (is_recurring=%). Impossible de créer un abonnement à partir d''un équipement ou frais unique.', NEW.source_order_item_id, v_is_recurring
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_recurring_only_guard ON public.billing_subscriptions;
CREATE TRIGGER trg_subscription_recurring_only_guard
BEFORE INSERT OR UPDATE OF frozen_name, frozen_code, plan_name, plan_code, source_order_item_id
ON public.billing_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.fn_subscription_recurring_only_guard();

COMMENT ON FUNCTION public.fn_subscription_recurring_only_guard() IS
  'INVARIANT-SUBSCRIPTION-RECURRING-ONLY — Rejette toute création/mise à jour d''abonnement contenant un équipement ou frais unique dans frozen_name/frozen_code/plan_name/plan_code. Non-négociable, tous chemins confondus.';